import { useState, useRef, useEffect, useCallback } from "react";

import { Send, Loader2, BarChart3, Leaf, Clock, ArrowUp } from "lucide-react";
import { getSuggestedChips, type UserWatch } from "@/components/mochi/ChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MochiTrailCard, { parseTrailBlocks } from "@/components/MochiTrailCard";
import MochiScannerBanner from "@/components/MochiScannerBanner";
import MochiStatusCard from "@/components/MochiStatusCard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import posthog from "@/lib/posthog";
import { useScannerStatus } from "@/hooks/useScannerStatus";


// Mochi pose assets (public directory)
const MOCHI_IDLE = "/mochi-neutral.png";
const MOCHI_POINTING = "/mochi-pointing.png";
const MOCHI_SCANNING = "/mochi-compass.png";
const MOCHI_CELEBRATING = "/mochi-celebrate.png";

type MochiPose = "idle" | "scanning" | "celebrating";

const MOCHI_ENTRANCE_KEY = "mochi_hero_entrance_done";

/**
 * Mochi hero illustration — standardized wrapper.
 *
 * Every pose renders inside a fixed 180×180 box with object-fit: contain so
 * intrinsic PNG canvas dimensions never affect perceived size or position.
 * A single UI-generated ground shadow is drawn identically for all poses.
 *
 * Long-term fix: re-export PNGs with center-of-mass padding so no
 * translateX hack is needed.
 */
const HERO_SIZE = 80;

const MochiHeroImage = ({ pose, size = HERO_SIZE }: { pose: MochiPose; size?: number }) => {
  const src = pose === "scanning" ? MOCHI_SCANNING : pose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_IDLE;
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasPlayedEntrance = useRef(sessionStorage.getItem(MOCHI_ENTRANCE_KEY) === "1");

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: "contain",
    objectPosition: "center bottom",
  };

  const groundShadow = (
    <div
      className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-foreground/[0.06] blur-[6px]"
      style={{ bottom: 2, width: size * 0.5, height: 6 }}
      aria-hidden="true"
    />
  );

  if (prefersReducedMotion) {
    return (
      <div className="relative inline-flex items-end justify-center" style={{ width: size, height: size }}>
        <img src={src} alt="Mochi" className="drop-shadow-md" style={imgStyle} loading="lazy" />
        {groundShadow}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-end justify-center" style={{ width: size, height: size }}>
      <motion.img
        src={src}
        alt="Mochi"
        className="drop-shadow-md"
        style={imgStyle}
        initial={hasPlayedEntrance.current ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={hasPlayedEntrance.current ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={() => {
          if (!hasPlayedEntrance.current) {
            sessionStorage.setItem(MOCHI_ENTRANCE_KEY, "1");
            hasPlayedEntrance.current = true;
          }
        }}
      />
      {groundShadow}
    </div>
  );
};

const PERMIT_KEYWORDS = [
  "available", "found", "open", "cancellation", "permit found",
  "spot open", "booking available", "just opened", "grab it",
];

/** Strip markdown table syntax before rendering — removes any line containing | */
const stripMarkdownTables = (text: string): string => {
  const lines = text.split('\n');
  const cleaned = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.includes('|') && !/^[-:\s]+$/.test(trimmed);
  });
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/** Convert inline and line-start bullet patterns using • into proper markdown lists */
const formatInlineBullets = (text: string): string => {
  let result = text.replace(
    /^(.+?:)\s*•\s*(.+)$/gm,
    (_match, label: string, rest: string) => {
      const items = rest.split(/\s*•\s*/).filter(Boolean);
      if (items.length < 2) return _match;
      return `${label}\n${items.map((item) => `- ${item.trim()}`).join("\n")}`;
    }
  );
  result = result.replace(/^•\s+/gm, "- ");
  return result;
};

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  isSystem?: boolean;
}

interface TrackedPermitInfo {
  permit_name: string;
  park_id: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mochi-chat`;
const SESSION_KEY = "mochi_introduced";

const DEFAULT_CHIPS = [
  "Check permits",
  "Best hikes today",
  "Crowds right now",
  "Weather forecast",
];

const BRIEFING_CHIP_SETS: string[][] = [
  ["Best parks this weekend", "Yosemite permit dates", "Cancellation patterns"],
  ["What's open in August?", "Best time for Glacier?", "How early to book?"],
  ["Tips for Half Dome?", "Zion peak season?", "Rainier permits?"],
  ["Grand Canyon crowds?", "Best fall parks?", "Weekend getaway?"],
];

const FIRST_SESSION_KEY = "wildatlas_first_session";
const PARK_CONTEXT_PREFIX = "mochi_park_greeted_";

const maskPhone = (phone: string): string => {
  if (!phone) return "your phone";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(***) ***-****";
  return `(***) ***-${digits.slice(-4)}`;
};

/** Time-of-day phrase for greeting */
const getTimePeriod = (): { label: string; casual: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { label: "Good morning", casual: "this morning" };
  if (hour >= 12 && hour < 17) return { label: "Good afternoon", casual: "this afternoon" };
  if (hour >= 17 && hour < 21) return { label: "Good evening", casual: "tonight" };
  return { label: "Hey", casual: "tonight" };
};
type VisitWindow = "weekend" | "2weeks" | "flexible";
const VISIT_OPTIONS: { key: VisitWindow; label: string }[] = [
  { key: "weekend", label: "This weekend" },
  { key: "2weeks", label: "Next 2 weeks" },
  { key: "flexible", label: "Flexible" },
];

const VisitWindowCard = () => {
  const [selected, setSelected] = useState<VisitWindow>("weekend");
  return (
    <div
      className="bg-card border border-border/50 rounded-2xl px-5 py-4 mb-4"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <p className="text-[13px] font-semibold text-foreground/80 mb-3">Select your visit window</p>
      <div className="flex gap-2">
        {VISIT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelected(opt.key)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 ${
                isSelected
                  ? "bg-status-scanning/20 text-foreground/85 border border-status-scanning/40"
                  : "bg-muted/40 text-muted-foreground/60 border border-transparent hover:bg-muted/60"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Strip table elements from markdown — render their text content as inline spans */
const MARKDOWN_NO_TABLES = {
  table: ({ children }: any) => <span style={{ display: 'block' }}>{children}</span>,
  thead: () => null,
  tbody: ({ children }: any) => <span style={{ display: 'block' }}>{children}</span>,
  tr: ({ children }: any) => <span style={{ display: 'block', marginBottom: '2px' }}>{children}</span>,
  th: ({ children }: any) => <strong>{children} </strong>,
  td: ({ children }: any) => <span>{children} </span>,
  hr: () => null,
};

const MochiChat = ({ onNavigateToDiscover, onNavigateToAlerts }: { onNavigateToDiscover?: (parkId: string) => void; onNavigateToAlerts?: () => void }) => {
  const { displayName, user } = useAuth();
  const { lastSuccessfulScanAt, getTimeAgo } = useScannerStatus();
  const [trackedPermits, setTrackedPermits] = useState<TrackedPermitInfo[]>([]);

  // Fetch user's tracked permits for dynamic greeting
  const fetchTrackedPermits = useCallback(() => {
    if (!user) return;
    supabase
      .from("user_watchers")
      .select("created_at, scan_targets(park_id, permit_type)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          setTrackedPermits(data.map((d: any) => ({
            permit_name: d.scan_targets?.permit_type ?? "",
            park_id: d.scan_targets?.park_id ?? "",
            created_at: d.created_at ?? undefined,
          })));
        }
      });
  }, [user]);

  useEffect(() => {
    fetchTrackedPermits();
  }, [fetchTrackedPermits]);

  // Realtime: refetch when user_watchers change (add/remove permits)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("mochi-watchers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_watchers", filter: `user_id=eq.${user.id}` },
        () => fetchTrackedPermits()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTrackedPermits]);

  // Cross-tab sync: refetch when watches change from other components on the same page
  useEffect(() => {
    const handler = () => fetchTrackedPermits();
    window.addEventListener("watches-changed", handler);
    return () => window.removeEventListener("watches-changed", handler);
  }, [fetchTrackedPermits]);

  // Check for first-session context
  const firstSessionRef = useRef<{ parkId: string; parkName: string; permitName: string; phone: string } | null>(null);
  const [firstSession] = useState<{ parkId: string; parkName: string; permitName: string; phone: string } | null>(() => {
    try {
      const raw = localStorage.getItem(FIRST_SESSION_KEY);
      if (raw) {
        localStorage.removeItem(FIRST_SESSION_KEY);
        const parsed = JSON.parse(raw);
        firstSessionRef.current = parsed;
        return parsed;
      }
    } catch {}
    return null;
  });

  // Derive primary park — state-driven so ParkSelector can update it
  const [selectedParkId, setSelectedParkId] = useState<string | null>(
    () => firstSession?.parkId || trackedPermits[0]?.park_id || localStorage.getItem("wildatlas_active_park") || null
  );

  const makeGreeting = (): Message => {
    const firstName = displayName?.trim().split(/\s+/)[0] || "";
    const { label: timeLabel, casual: timeCasual } = getTimePeriod();
    const parkName = PARKS[selectedParkId]?.shortName || "the parks";

    // ── First-session welcome (one-time after onboarding) ──
    if (firstSession && firstSession.permitName) {
      const fs = firstSession;
      const phoneMasked = fs.phone ? maskPhone(fs.phone) : null;
      const alertLine = phoneMasked
        ? `If one becomes available, I'll text you at ${phoneMasked}.`
        : "If one becomes available, I'll alert you immediately.";

      const content = `I'm watching for ${fs.permitName} permits in ${fs.parkName}. When are you planning to visit?`;

      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content };
    }

    // ── Standard greeting — scanning status only ──
    const primaryParkPermits = trackedPermits.filter((p) => p.park_id === selectedParkId);

    // Estimate checks using same formula as MochiScannerBanner (2-min interval)
    const SCAN_INTERVAL_MS = 2 * 60 * 1000;
    const earliest = trackedPermits.reduce<number | null>((min, p) => {
      if (!p.created_at) return min;
      const t = new Date(p.created_at).getTime();
      return min === null ? t : Math.min(min, t);
    }, null);
    const estimatedChecks = earliest !== null ? Math.floor(Math.max(0, Date.now() - earliest) / SCAN_INTERVAL_MS) : null;
    const checksLine = estimatedChecks !== null && estimatedChecks > 0
      ? estimatedChecks.toLocaleString()
      : null;

    let body: string;

    if (primaryParkPermits.length > 0) {
      const permitNames = primaryParkPermits.map((p) => p.permit_name).join(" and ");
      body = checksLine
        ? `I've been watching ${permitNames} at ${parkName}. Your best shot is usually early morning, when cancellations tend to open up. Ask me anything about your trip.`
        : `I'm on ${permitNames} at ${parkName} and scanning now. Cancellations tend to surface early morning — that's the window worth watching. Ask me anything about your trip.`;
    } else if (trackedPermits.length > 0) {
      body = `Watching ${trackedPermits.length} permit${trackedPermits.length > 1 ? "s" : ""} across your parks. Cancellations tend to surface early morning — that's the window worth watching. Ask me anything about your trip.`;
    } else {
      body = "What park are you heading to? I can check permit availability, suggest the best times to visit, and alert you to openings.";
    }

    const greetLine = "";
    const content = `${greetLine}${body}`.trim();
    sessionStorage.setItem(SESSION_KEY, "true");
    return { id: 1, role: "assistant", content };
  };

  const [messages, setMessages] = useState<Message[]>(() => [makeGreeting()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [mochiPose, setMochiPose] = useState<MochiPose>("idle");
  const [chipsHidden, setChipsHidden] = useState(false);
  const [briefingChipSetIdx, setBriefingChipSetIdx] = useState(0);
  const [usedBriefingChips, setUsedBriefingChips] = useState<Set<string>>(new Set());
  const briefingChipUsedCount = useRef(0);
  const briefingChipTotal = useRef(BRIEFING_CHIP_SETS[0].length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMountRef = useRef(true);
  const prevPrimaryParkRef = useRef(selectedParkId);
  const sendTimestamps = useRef<number[]>([]);
  const pendingSendRef = useRef<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const keyboardRafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateKeyboardInset = () => {
      cancelAnimationFrame(keyboardRafRef.current);
      keyboardRafRef.current = requestAnimationFrame(() => {
        const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        setKeyboardInset((prev) => {
          const next = inset > 80 ? inset : 0;
          return next === prev ? prev : next;
        });
      });
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);

    return () => {
      cancelAnimationFrame(keyboardRafRef.current);
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("orientationchange", updateKeyboardInset);
    };
  }, []);

  // Update greeting when primary park changes (from tracked permits)
  useEffect(() => {
    if (selectedParkId !== prevPrimaryParkRef.current) {
      prevPrimaryParkRef.current = selectedParkId;
      const isBriefingState = messages.length <= 2 && messages[0]?.id === 1;
      if (isBriefingState && !firstSession) {
        setMessages([makeGreeting()]);
      }
    }
  }, [selectedParkId]);

  // Rebuild greeting when tracked permits load or displayName changes
  const prevNameRef = useRef(displayName);
  const prevTrackedRef = useRef(trackedPermits);
  useEffect(() => {
    const nameChanged = displayName !== prevNameRef.current;
    const trackedChanged = trackedPermits !== prevTrackedRef.current && trackedPermits.length > 0;
    if (nameChanged || trackedChanged) {
      prevNameRef.current = displayName;
      prevTrackedRef.current = trackedPermits;
      const isBriefingState = messages.length <= 2 && messages[0]?.id === 1;
      if (isBriefingState && !firstSession) {
        setMessages([makeGreeting()]);
      }
    }
  }, [displayName, trackedPermits]);

  useEffect(() => {
    if (initialMountRef.current) { initialMountRef.current = false; return; }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send when pendingSendRef is set
  useEffect(() => {
    if (pendingSendRef.current && input === pendingSendRef.current && !isLoading) {
      pendingSendRef.current = null;
      handleSend();
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || rateLimited) return;

    const now = Date.now();
    sendTimestamps.current = sendTimestamps.current.filter((t) => now - t < 60_000);
    if (sendTimestamps.current.length >= 5) {
      setRateLimited(true);
      setMessages((prev) => [
        ...prev,
        { id: now, role: "assistant", content: "Whoa, slow down! Let me catch my breath. Try again in 15 seconds.", isSystem: true },
      ]);
      setTimeout(() => setRateLimited(false), 15_000);
      return;
    }
    sendTimestamps.current.push(now);

    posthog.capture("mochi_message_sent");
    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setMochiPose("scanning");

    const history = [...messages, userMsg]
      .filter((m) => m.id !== 1)
      .map((m) => ({ role: m.role, content: m.content }));
    let assistantContent = "";
    const arrivalDate = localStorage.getItem("wildatlas_arrival_date") || null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("auth_required");
      }
      const token = session.access_token;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history, arrivalDate, parkId: selectedParkId }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Stream failed" }));
        if (resp.status === 429) {
          const isDailyCap = err.error?.includes("daily limit");
          throw new Error(isDailyCap ? "daily_cap" : "rate_limit");
        }
        if (resp.status >= 500) throw new Error("server_error");
        throw new Error(err.error || "Stream failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const assistantId = Date.now() + 1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              const snap = assistantContent;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === assistantId) {
                  return prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m));
                }
                return [...prev, { id: assistantId, role: "assistant", content: snap }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("[mochi-chat] client error:", e.name, e.message);
      let errorMsg: string;
      if (e.name === "AbortError") {
        errorMsg = "Response timed out — try again in a moment.";
      } else if (e.message === "daily_cap") {
        errorMsg = "You've hit your daily Mochi limit. Upgrade to Pro for unlimited chats!";
      } else if (e.message === "rate_limit") {
        errorMsg = "Too many questions at once. Give it a minute and try again.";
      } else if (e.message === "server_error") {
        errorMsg = "Mochi ran into a problem. Wait a moment and try again — if it keeps happening, reload the page.";
      } else if (e.message === "auth_required") {
        errorMsg = "You need to be signed in to chat with Mochi.";
      } else if (!navigator.onLine) {
        errorMsg = "You seem to be offline Check your connection and try again.";
      } else {
        errorMsg = "Mochi ran into a problem. Wait a moment and try again — if it keeps happening, reload the page.";
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: "assistant", content: errorMsg },
      ]);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
      setChipsHidden(false);
      // Check if last assistant message contains permit availability language
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "assistant") {
          const lower = lastMsg.content.toLowerCase();
          const isPermitRelated = PERMIT_KEYWORDS.some((kw) => lower.includes(kw));
          setMochiPose(isPermitRelated ? "celebrating" : "idle");
          if (isPermitRelated) {
            setTimeout(() => setMochiPose("idle"), 5000);
          }
        } else {
          setMochiPose("idle");
        }
        return prev;
      });
    }
  };

  const isBriefing = true; // always use new premium landscape design for light mode
  const composerBottomPadding = `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset > 0 ? keyboardInset + 12 : 96}px)`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [keyboardInset]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSend();
  };

  const renderComposer = ({
    tone,
    showDisclaimer = false,
  }: {
    tone: "dark" | "light";
    showDisclaimer?: boolean;
  }) => {
    const isDark = tone === "dark";

    return (
      <div
        style={{
          flexShrink: 0,
          background: isDark ? "transparent" : "#F0EDEA",
          borderTop: isDark ? undefined : "1px solid #DDD9D4",
          paddingTop: isDark ? 8 : 10,
          paddingLeft: isDark ? 16 : 20,
          paddingRight: isDark ? 16 : 20,
          paddingBottom: isDark ? 8 : 8,
        }}
      >
        <div
          className={`flex items-center ${isDark ? '' : 'mochi-light-composer'}`}
          style={
            isDark
              ? {
                  borderRadius: 20,
                  background: "hsl(145 22% 14%)",
                  border: "1px solid hsl(0 0% 100% / 0.10)",
                  borderTop: "1px solid hsl(0 0% 100% / 0.15)",
                  padding: "10px 10px 10px 20px",
                  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.30)",
                }
              : {
                  borderRadius: 28,
                  background: "rgba(252,248,242,0.96)",
                  border: "0.5px solid rgba(180,162,136,0.42)",
                  padding: "8px 8px 8px 16px",
                  position: "relative" as const,
                }
          }
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Permits, parks, timing…"
            aria-label="Ask Mochi anything"
            className={isDark ? "mochi-dark-input" : "mochi-light-input"}
            style={
              isDark
                ? {
                    flex: 1,
                    background: "transparent",
                    fontSize: 15,
                    fontFamily: "'Inter Tight', sans-serif",
                    color: "hsl(39 33% 96%)",
                    outline: "none",
                    border: "none",
                    minWidth: 0,
                  }
                : {
                    flex: 1,
                    background: "transparent",
                    fontSize: 14,
                    fontWeight: 300,
                    fontFamily: "'DM Sans', sans-serif",
                    color: "#1C1C19",
                    outline: "none",
                    border: "none",
                    minWidth: 0,
                  }
            }
            disabled={isLoading}
          />
          <style>{`
            .mochi-light-composer:focus-within {
              border-color: #2F6F4E !important;
              transition: border-color 0.18s ease;
            }
            .mochi-light-composer input::placeholder {
              color: #C0BBB4;
            }
            .mochi-light-composer input:focus {
              outline: none;
              box-shadow: none;
            }
          `}</style>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            className="shrink-0 flex items-center justify-center transition-all active:scale-95"
            style={{
              width: 44,
              height: 44,
              borderRadius: isDark ? 14 : 13,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              opacity: (!input.trim() || isLoading) ? 0.5 : 1,
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
          </button>
        </div>

        {showDisclaimer && (
          <p style={{ fontSize: 10, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: '#B8B2AB', textAlign: 'center', padding: '4px 20px 12px', lineHeight: 1.5, margin: 0 }}>
            Mochi gives general park guidance. Verify rules, conditions, and closures with official park sources before your visit.
          </p>
        )}
      </div>
    );
  };

  const handleChipTap = useCallback((chipLabel: string) => {
    setChipsHidden(true);
    pendingSendRef.current = chipLabel;
    setInput(chipLabel);
  }, []);

  const handleBriefingChipTap = useCallback((label: string) => {
    // Mark chip as used (triggers collapse animation)
    setUsedBriefingChips((prev) => new Set(prev).add(label));
    // Send as message
    handleChipTap(label);
    // Track usage count
    briefingChipUsedCount.current += 1;
    if (briefingChipUsedCount.current >= briefingChipTotal.current) {
      // All chips used — fade out, then replenish
      setTimeout(() => {
        setBriefingChipSetIdx((prev) => (prev + 1) % BRIEFING_CHIP_SETS.length);
        setUsedBriefingChips(new Set());
        briefingChipUsedCount.current = 0;
        briefingChipTotal.current = BRIEFING_CHIP_SETS[(briefingChipSetIdx + 1) % BRIEFING_CHIP_SETS.length].length;
        setChipsHidden(false);
      }, 650);
    }
  }, [handleChipTap, briefingChipSetIdx]);

  // Park-aware quick prompts based on tracked permits
  const quickParkName = PARKS[selectedParkId]?.shortName || "the parks";
  const primaryParkPermits = trackedPermits.filter((p) => p.park_id === selectedParkId);
  const primaryPermit = firstSession?.permitName || primaryParkPermits[0]?.permit_name || trackedPermits[0]?.permit_name;

  const parkSelectionPrompts = [
    { label: "Yosemite",       descriptor: "Explore this park", icon: Leaf, message: "Tell me about Yosemite" },
    { label: "Zion",           descriptor: "Explore this park", icon: Leaf, message: "Tell me about Zion" },
    { label: "Grand Canyon",   descriptor: "Explore this park", icon: Leaf, message: "Tell me about Grand Canyon" },
    { label: "Glacier",        descriptor: "Explore this park", icon: Leaf, message: "Tell me about Glacier" },
    { label: "Rocky Mountain", descriptor: "Explore this park", icon: Leaf, message: "Tell me about Rocky Mountain" },
    { label: "Rainier",        descriptor: "Explore this park", icon: Leaf, message: "Tell me about Rainier" },
    { label: "Arches",         descriptor: "Explore this park", icon: Leaf, message: "Tell me about Arches" },
  ];

  const quickPrompts = selectedParkId === null
    ? parkSelectionPrompts
    : trackedPermits.length === 0
      ? [
          { label: "Permits 101", descriptor: "How it works", icon: BarChart3 },
          { label: "Tracked parks", descriptor: "All parks live", icon: Leaf },
        ]
      : [
          { label: "Crowd level", descriptor: "How busy is it?", icon: Leaf },
          { label: "Permit odds", descriptor: "What are my chances?", icon: BarChart3 },
          { label: "Best time", descriptor: "When should I go?", icon: Clock },
        ];

  const [tappedChips, setTappedChips] = useState<Set<string>>(new Set());

  const renderChipRow = (prompts: { label: string; descriptor: string; icon: typeof BarChart3 }[], fadeBg?: string) => {
    return (
      <div className="relative">
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            overflowX: 'auto',
            gap: 10,
            padding: '4px 20px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style>{`.chip-scroll::-webkit-scrollbar { display: none; }`}</style>
          {prompts.map((prompt, i) => {
            const Icon = prompt.icon;
            const wasTapped = tappedChips.has(prompt.label);
            return (
              <motion.button
                key={prompt.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: wasTapped ? 0.6 : 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.25 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setTappedChips(prev => new Set(prev).add(prompt.label));
                  handleChipTap(`${prompt.label}: ${prompt.descriptor}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTappedChips(prev => new Set(prev).add(prompt.label));
                    handleChipTap(`${prompt.label}: ${prompt.descriptor}`);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${prompt.label}: ${prompt.descriptor}`}
                style={{
                  flexShrink: 0,
                  width: 'auto',
                  minWidth: 120,
                  maxWidth: 180,
                  padding: '13px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  gap: 4,
                  background: '#FFFFFF',
                  border: '1px solid #DDD9D4',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className="shrink-0" style={{ color: '#2F6F4E' }} strokeWidth={1.5} />
                  <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#1C1C19', whiteSpace: 'nowrap', display: 'block' }}>{prompt.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: '#9A9289', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>{prompt.descriptor}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  // Get unique tracked parks (id + name) for the monitoring indicator
  const trackedParksUnique = [...new Map(
    trackedPermits.map((p) => [p.park_id, { id: p.park_id, name: PARKS[p.park_id]?.shortName }])
  ).values()].filter((p) => p.name);

  return (
    <div
      className="h-full min-h-0 flex flex-col"
      style={{
        background: isBriefing ? '#E8E2D9' : undefined,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        position: 'relative',
      }}
    >
      {/* Header — briefing: none / conversation: Mochi avatar */}
      {isBriefing ? null : (
        <div className="px-5 pt-4 pb-2 flex items-center gap-3" style={{ borderBottom: '1px solid #DDD9D4' }}>
          <div className="w-10 h-10 rounded-full border border-border/40 flex items-center justify-center overflow-hidden" style={{ background: '#F0EDEA' }}>
            <motion.img
              key={mochiPose}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              src={mochiPose === "scanning" ? MOCHI_SCANNING : mochiPose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_IDLE}
              alt=""
              aria-hidden="true"
              className="w-8 h-8 object-contain object-center"
            />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#1C1C19', margin: 0 }}>Mochi</p>
            <p style={{ fontSize: 11, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: '#9A9289', margin: 0 }}>your park companion</p>
          </div>
        </div>
      )}




      {isBriefing ? (
        <div className="flex-1 min-h-0 flex flex-col relative" style={{ background: '#E8E2D9' }}>
          {/* Full-bleed SVG landscape scene */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
            viewBox="0 0 390 844"
            preserveAspectRatio="xMidYMin slice"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mochi-sk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7EAAC8" stopOpacity="1" />
                <stop offset="10%" stopColor="#C4889A" stopOpacity=".42" />
                <stop offset="20%" stopColor="#B89560" stopOpacity=".88" />
                <stop offset="36%" stopColor="#C6A43A" stopOpacity=".48" />
                <stop offset="52%" stopColor="#D0B252" stopOpacity=".18" />
                <stop offset="66%" stopColor="#DCCAA8" stopOpacity=".07" />
                <stop offset="78%" stopColor="#E8E2D9" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="mochi-sg" cx="63%" cy="11%" r="26%">
                <stop offset="0%" stopColor="#FFFAD0" stopOpacity=".98" />
                <stop offset="11%" stopColor="#FFD84A" stopOpacity=".72" />
                <stop offset="30%" stopColor="#F4A830" stopOpacity=".28" />
                <stop offset="58%" stopColor="#E8A030" stopOpacity=".07" />
                <stop offset="100%" stopColor="#E8E2D9" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mochi-sh" cx="63%" cy="11%" r="4.5%">
                <stop offset="0%" stopColor="#FFFFF4" />
                <stop offset="100%" stopColor="#FFF8C0" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="mochi-r1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#BACEDA" />
                <stop offset="60%" stopColor="#CCDADC" />
                <stop offset="100%" stopColor="#C8D8DC" />
              </linearGradient>
              <linearGradient id="mochi-r2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#5E8278" />
                <stop offset="60%" stopColor="#769A90" />
                <stop offset="100%" stopColor="#7E9E96" />
              </linearGradient>
              <linearGradient id="mochi-r3" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#365848" />
                <stop offset="60%" stopColor="#486E60" />
                <stop offset="100%" stopColor="#507868" />
              </linearGradient>
              <linearGradient id="mochi-r4" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#243830" />
                <stop offset="60%" stopColor="#324E44" />
                <stop offset="100%" stopColor="#384E48" />
              </linearGradient>
            </defs>

            <rect width="390" height="844" fill="url(#mochi-sk)" />

            {/* Sun glow */}
            <ellipse cx="246" cy="93" rx="110" ry="88" fill="url(#mochi-sg)" />
            {/* Sun highlight removed — was causing white dot artifact */}

            {/* Clouds */}
            <path d="M8,172 Q18,158 34,162 Q46,148 60,154 Q74,140 88,148 Q100,136 116,143 Q98,172 8,169Z" fill="#FFF8DC" opacity=".2" />
            <path d="M148,118 Q172,94 204,110 Q228,88 264,104 Q288,84 318,98 Q336,82 352,90 Q328,128 148,124Z" fill="#FFF8DC" opacity=".16" />
            <path d="M330,158 Q352,138 374,150 Q384,138 390,144 L390,162 Q366,178 330,166Z" fill="#FFF8DC" opacity=".12" />
            <path d="M0,204 Q12,188 26,194 Q36,180 48,186 Q38,210 0,208Z" fill="#FFF8DC" opacity=".1" />

            {/* Mountain ridge 1 — farthest */}
            <path d="M0,844 L0,562 C18,554 32,538 48,522 C64,506 80,532 98,516 C116,500 134,466 156,450 C176,436 194,472 214,456 C232,440 248,408 268,392 C288,378 304,414 322,398 C342,382 360,362 380,374 L390,368 L390,844Z" fill="url(#mochi-r1)" opacity=".46" />

            {/* Mountain ridge 2 */}
            <path d="M0,844 L0,612 C14,602 30,584 50,570 C68,556 86,580 106,568 C128,554 148,526 170,514 C192,502 210,528 230,516 C252,502 268,474 290,462 C310,450 328,476 350,464 C368,452 382,437 390,430 L390,844Z" fill="url(#mochi-r2)" opacity=".6" />

            {/* Mountain ridge 3 */}
            <path d="M0,844 L0,666 C12,656 28,640 50,628 C72,616 92,634 116,624 C140,612 160,592 184,582 C206,572 224,590 248,580 C270,570 288,550 314,540 C336,530 358,546 380,536 L390,532 L390,844Z" fill="url(#mochi-r3)" opacity=".76" />

            {/* Mountain ridge 4 — closest */}
            <path d="M0,844 L0,716 C20,706 42,692 68,682 C94,672 118,690 144,680 C170,670 192,654 220,646 C246,638 268,652 294,644 C320,634 344,620 370,610 L390,606 L390,844Z" fill="url(#mochi-r4)" opacity=".8" />

            {/* Treeline serration */}
            <path d="M0,706 L5,700 L9,704 L14,698 L20,703 L28,697 L33,701 L40,695 L48,700 L58,693 L65,698 L76,692 L82,697 L92,690 L104,695 L112,689 L124,694 L136,688 L148,693 L158,687 L172,692 L183,686 L196,692 L208,685 L224,691 L238,684 L252,690 L264,683 L279,689 L295,682 L310,688 L324,681 L340,687 L356,680 L370,686 L382,679 L390,684 L390,724 L0,724Z" fill="#283E34" opacity=".2" />

            {/* Ground texture */}
            <path d="M0,756 C55,750 120,744 185,748 C250,752 318,745 390,749 L390,764 C318,760 250,767 185,763 C120,759 55,765 0,770Z" fill="#20342C" opacity=".06" />
          </svg>

          {/* Content layer — z-index 10 */}
          <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Topbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'calc(env(safe-area-inset-top, 44px) + 10px)', paddingLeft: 24, paddingRight: 24, paddingBottom: 0, flexShrink: 0 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 400, letterSpacing: '0.06em', color: 'rgba(28,24,18,0.80)' }}>WildAtlas</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(36,76,52,0.75)', fontFamily: "'DM Sans', sans-serif" }}>
                <span className="mochi-scan-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: '#2F6F4E', flexShrink: 0 }} />
                <span>{(() => { const n = trackedParksUnique.length > 0 ? trackedParksUnique.length : Object.keys(PARKS).length; return `${n} PARK${n === 1 ? '' : 'S'} · LIVE`; })()}</span>
              </div>
            </div>

            {/* Hero — orb + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 0', flexShrink: 0 }}>
              <style>{`
                @keyframes mochi-orb-breathe {
                  0%, 100% { transform: scale(1.0); }
                  50% { transform: scale(1.03); }
                }
                .mochi-orb-breathe {
                  animation: mochi-orb-breathe 3s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                  .mochi-orb-breathe {
                    animation: none;
                  }
                }
              `}</style>
              <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 4 }}>
                <div className="mochi-orb-breathe" style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(125deg, #F6EFE2 0%, #EAF2EC 100%)', border: '0.5px solid rgba(47,111,78,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 20px rgba(100,80,40,.08), 0 1px 4px rgba(100,80,40,.05)' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 300, fontStyle: 'italic', color: '#2F6F4E', lineHeight: 1, letterSpacing: '-0.01em' }}>M</span>
                </div>
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, letterSpacing: '0.02em', color: '#1A1814', lineHeight: 1, margin: 0, marginBottom: 12 }}>Mochi</h1>
            </div>

            {/* Scrollable chat content */}
            <div
              ref={scrollRef}
              data-tab-scroll
              style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 16, paddingLeft: 16, paddingRight: 16, paddingBottom: 0, position: 'relative', minHeight: 0, scrollbarWidth: 'none' as const }}
            >
              {/* Chat bubbles — assistant (cream, left) and user (green, right) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                {messages.map((msg, idx) => {
                  const isAssistant = msg.role === 'assistant';
                  const isFirst = idx === 0 || messages[idx - 1].role !== msg.role;
                  return (
                    <div key={msg.id} className="mochi-fade-up"
                      style={{ animationDelay: `${idx * 0.12}s`,
                        maxWidth: isAssistant ? '85%' : '84%',
                        alignSelf: isAssistant ? 'center' : 'flex-end',
                        marginLeft: isAssistant ? 4 : 'auto',
                        marginRight: isAssistant ? 4 : 0,
                        marginTop: idx === 0 ? 0 : 4 }}>
                      <div style={isAssistant ? {
                        background: 'rgba(244, 238, 228, 0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(180,160,130,0.25)',
                        borderRadius: 24,
                        padding: '14px 18px', fontSize: 14, fontWeight: 400,
                        fontFamily: "'DM Sans', sans-serif", color: '#2C2416', lineHeight: 1.7,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                      } : {
                        background: 'rgba(47, 111, 78, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#F0EDEA',
                        borderRadius: '18px 10px 18px 18px',
                        padding: '11px 15px', fontSize: 13, fontWeight: 300,
                        fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                      }}>
                        {isAssistant
                          ? <div className="mochi-prose"><ReactMarkdown components={MARKDOWN_NO_TABLES}>{formatInlineBullets(stripMarkdownTables(msg.content))}</ReactMarkdown></div>
                          : msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chips row */}
            {!chipsHidden && (
              <div style={{ padding: '10px 0 0', flexShrink: 0, position: 'relative', marginTop: 'auto' }}>
                {/* Non-scrolling styled wrapper */}
                <div style={{
                  background: 'rgba(244,238,228,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  borderRadius: 20, border: '1px solid rgba(180,160,130,0.2)',
                  overflow: 'hidden', position: 'relative',
                  marginLeft: 16, marginRight: 16,
                }}>
                  <style>{`.mochi-chips-scroll::-webkit-scrollbar { display: none; }`}</style>
                  <div className="mochi-chips-scroll" style={{
                    display: 'flex', flexDirection: 'row', gap: 6,
                    overflowX: 'auto', overflowY: 'visible',
                    WebkitOverflowScrolling: 'touch' as const,
                    scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const,
                    flexShrink: 0, transition: 'opacity 0.25s',
                    paddingLeft: 16, paddingRight: 48,
                    paddingTop: 10, paddingBottom: 10,
                  }}>
                    {BRIEFING_CHIP_SETS[briefingChipSetIdx].map((label) => (
                      <span
                        key={label}
                        role="button"
                        tabIndex={0}
                        className={`mochi-briefing-chip ${usedBriefingChips.has(label) ? 'mochi-chip-out' : ''}`}
                        onClick={() => handleBriefingChipTap(label)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBriefingChipTap(label); } }}
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          fontFamily: "'DM Sans', sans-serif",
                          color: 'rgba(28,24,18,0.78)',
                          background: 'rgba(244,238,228,.88)',
                          border: '1px solid rgba(28,24,18,0.12)',
                          padding: '8px 14px',
                          borderRadius: 20,
                          whiteSpace: 'nowrap' as const,
                          cursor: 'pointer',
                          flexShrink: 0,
                          letterSpacing: '0.01em',
                          transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {/* Right fade overlay — signals scrollability */}
                  <div style={{
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: 48,
                    background: 'linear-gradient(to right, transparent, rgba(232,226,217,0.95))',
                    pointerEvents: 'none', zIndex: 1,
                  }} />
                </div>
              </div>
            )}

            {/* Input pill */}
            <div style={{ padding: `10px 16px ${composerBottomPadding}`, flexShrink: 0, transition: 'padding-bottom 0.22s ease-out', background: 'rgba(240,237,234,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(28,24,18,0.08)' }}>
              <div
                className="mochi-input-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(252,248,242,.96)',
                  border: '0.5px solid rgba(180,162,136,.42)',
                  borderRadius: 28,
                  padding: '9px 8px 9px 16px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Permits, parks, timing…"
                  aria-label="Ask Mochi"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 300,
                    color: '#1A1814',
                    outline: 'none',
                    padding: '3px 0',
                    minWidth: 0,
                  }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#2F6F4E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: 'none',
                    transition: 'background 0.15s, transform 0.12s',
                    opacity: (!input.trim() || isLoading) ? 0.5 : 1,
                  }}
                >
                  {isLoading ? (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#F0EDEA' }} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 11L11 6L1 1v3.8l6.5 1.2L1 7.2V11z" fill="#F0EDEA"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

          </div>{/* end content layer */}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" data-tab-scroll style={{ position: 'relative' }}>
            <div style={{ padding: '16px 16px 0' }} aria-live="polite" aria-atomic="false" aria-relevant="additions">
              {messages.map((msg, idx) => {
                if (msg.isSystem) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ display: 'flex', justifyContent: 'center', margin: '8px auto', maxWidth: 260 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9A9289', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: '#9A9289', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
                      </div>
                    </motion.div>
                  );
                }

                // Detect consecutive messages from same role for grouping
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role || prevMsg.isSystem;
                const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
                const isLastInGroup = !nextMsg || nextMsg.role !== msg.role || nextMsg.isSystem;

                // Detect info-dense Mochi response
                const isDense = msg.role === "assistant" && (
                  /^#{2,3}\s/m.test(msg.content) ||
                  (msg.content.match(/^[-*•]\s/gm) || []).length >= 3
                );

                // Spacing: 2px within group, 8px between groups
                const marginTop = idx === 0 ? 0 : isFirstInGroup ? 8 : 2;

                return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.8, 0.4, 1] }}
                  className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                  style={{ marginTop, marginBottom: isLastInGroup ? 0 : 0 }}
                >
                  <div
                    style={
                      msg.role === "assistant"
                        ? {
                            maxWidth: '84%',
                            background: 'rgba(244, 238, 228, 0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            border: '0.5px solid rgba(195, 178, 152, 0.45)',
                            borderLeft: isDense ? '2px solid #EBF2EE' : '0.5px solid rgba(195, 178, 152, 0.45)',
                            borderRadius: isFirstInGroup ? '12px 18px 18px 18px' : '18px 18px 18px 18px',
                            padding: '11px 15px',
                            fontSize: 13,
                            fontWeight: 300,
                            fontFamily: "'DM Sans', sans-serif",
                            color: 'rgba(28,24,18,.8)',
                            lineHeight: 1.6,
                          }
                        : {
                            maxWidth: '84%',
                            background: 'rgba(47, 111, 78, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            color: '#F0EDEA',
                            borderRadius: '18px 10px 18px 18px',
                            padding: '11px 15px',
                            fontSize: 13,
                            fontWeight: 300,
                            fontFamily: "'DM Sans', sans-serif",
                            lineHeight: 1.6,
                          }
                    }
                  >
                    {msg.role === "assistant" ? (
                      <div className="mochi-prose">
                        {parseTrailBlocks(msg.content).map((block, bi) =>
                          block.type === "trails" ? (
                            <div key={bi} className="space-y-2 -mx-1">
                              {block.value.map((trail, ti) => (
                                <MochiTrailCard key={ti} trail={trail} />
                              ))}
                            </div>
                          ) : (
                            <div key={bi}><ReactMarkdown components={MARKDOWN_NO_TABLES}>{formatInlineBullets(stripMarkdownTables(block.value))}</ReactMarkdown></div>
                          )
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
                );
              })}

              <AnimatePresence>
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.8, 0.4, 1] }}
                    className="flex justify-start"
                    style={{ marginTop: 8 }}
                  >
                    <div style={{
                      background: 'rgba(244, 238, 228, 0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                      border: '0.5px solid rgba(195, 178, 152, 0.45)',
                      borderRadius: '12px 18px 18px 18px',
                      padding: '12px 15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      width: 54,
                    }}>
                      <span className="mochi-typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(47,111,78,.35)', animationDelay: '0s' }} />
                      <span className="mochi-typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(47,111,78,.35)', animationDelay: '0.16s' }} />
                      <span className="mochi-typing-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(47,111,78,.35)', animationDelay: '0.32s' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Fade gradient at bottom of chat scroll */}
            <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, rgba(232,226,217,0), rgba(232,226,217,1))', pointerEvents: 'none', zIndex: 2 }} />
          </div>

          {/* Chip row — outside scroll, directly above input */}
          {!isLoading && !chipsHidden && messages[messages.length - 1]?.role === "assistant" && (() => {
            const lastReply = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
            const watches: UserWatch[] = trackedPermits.map((p) => ({ park_id: p.park_id, permit_name: p.permit_name }));
            const chips = getSuggestedChips(lastReply, watches, quickParkName === "the parks" ? null : quickParkName);
            return <div style={{ flexShrink: 0, padding: '0 16px 12px' }}>{renderChipRow(chips)}</div>;
          })()}

          {renderComposer({ tone: "light", showDisclaimer: true })}

          {/* Keyboard spacer — only when keyboard is open */}
          <div style={{ flexShrink: 0, height: keyboardInset > 0 ? keyboardInset + 8 : 0, background: '#E8E2D9', transition: 'height 0.22s ease-out', overflow: 'hidden' }} />
        </div>
      )}
    </div>
  );
};

export default MochiChat;

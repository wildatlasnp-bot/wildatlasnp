import { useState, useRef, useEffect, useCallback } from "react";
import mochiWaveImg from "@/assets/mochi-wave.png";

import { Send, Loader2, BarChart3, Leaf, Clock, ArrowUp } from "lucide-react";
import { getSuggestedChips, type UserWatch } from "@/components/mochi/ChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MochiTrailCard, { parseTrailBlocks } from "@/components/MochiTrailCard";
import MochiScannerBanner from "@/components/MochiScannerBanner";
import MochiStatusCard from "@/components/MochiStatusCard";
import ProModal from "@/components/ProModal";
import ParkSelector from "@/components/ParkSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import posthog from "@/lib/posthog";
import { useScannerStatus } from "@/hooks/useScannerStatus";


  // Handle initialQuery from external navigation (e.g. Discover trip card)
  const initialQueryProcessed = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialQueryProcessed.current) {
      initialQueryProcessed.current = true;
      pendingSendRef.current = initialQuery;
      setInput(initialQuery);
    }
  }, [initialQuery]);


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
        <img src={src} alt="Poko" className="drop-shadow-md" style={imgStyle} loading="lazy" />
        {groundShadow}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-end justify-center" style={{ width: size, height: size }}>
      <motion.img
        src={src}
        alt="Poko"
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

/**
 * Post-process Mochi responses to append safety disclaimers
 * for permit dates and trail conditions when appropriate.
 */
/**
 * Post-process Mochi responses. Returns cleaned text WITHOUT appending disclaimers.
 * Use shouldShowDisclaimer() to check if the inline disclaimer badge should render.
 */
function sanitizeMochiResponse(text: string): string {
  if (!text) return text;
  // No longer appending disclaimer text — rendered as separate component
  return text;
}

const DISCLAIMER_PERMIT_KW = [
  "lottery", "opens march", "opens april", "permit dates",
  "reservation window", "recreation.gov", "weeks in advance",
  "daily lottery", "pre-season", "walk-up",
];
const DISCLAIMER_TRAIL_KW = [
  "trail is open", "trails are open", "cables are up", "road is open",
  "currently open", "currently closed", "trail conditions", "snow conditions",
];

function shouldShowDisclaimer(text: string): boolean {
  if (!text) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) return false;
  const lower = text.toLowerCase();
  return DISCLAIMER_PERMIT_KW.some((kw) => lower.includes(kw)) ||
    DISCLAIMER_TRAIL_KW.some((kw) => lower.includes(kw));
}

/** Inline disclaimer rendered below bubbles that triggered it */
const InlineDisclaimer = () => (
  <div style={{
    borderLeft: '2px solid var(--wa-amber-accent)',
    background: 'rgba(239,159,39,0.06)',
    padding: '6px 10px',
    borderRadius: 4,
    marginTop: 4,
    maxWidth: '85%',
  }}>
    <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: 'var(--wa-amber-ink)', fontWeight: 400 }}>
      Verify with official park sources.
    </span>
  </div>
);

/** Rate limit upgrade card rendered inline in chat */
const RateLimitUpgradeCard = ({ onUpgrade }: { onUpgrade: () => void }) => (
  <div style={{
    background: 'var(--wa-cream)',
    borderRadius: 24,
    padding: '18px 18px 16px',
    maxWidth: '85%',
  }}>
    <img src="/mochi-worried.png" alt="Poko worried" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 10 }} />
    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: 'italic', color: 'var(--wa-ink-forest)', margin: '0 0 4px', lineHeight: 1.4 }}>
      You've reached your daily limit.
    </p>
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(58,62,59,0.55)', margin: '0 0 14px', lineHeight: 1.4 }}>
      Pro users get unlimited Poko.
    </p>
    <button
      onClick={onUpgrade}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 10,
        background: 'var(--wa-green)',
        color: 'var(--wa-cream)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Upgrade to Pro
    </button>
  </div>
);

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
  isRateLimitCard?: boolean;
  hasDisclaimer?: boolean;
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
  ["When do Zion Narrows permits drop?", "Best time to visit Arches in spring?", "How crowded is Half Dome on weekends?", "What gear do I need for Glacier?"],
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

const MochiChat = ({ onNavigateToDiscover, onNavigateToAlerts, initialQuery }: { onNavigateToDiscover?: (parkId: string) => void; onNavigateToAlerts?: () => void; initialQuery?: string | null }) => {
  const { displayName, user } = useAuth();
  const { isPro } = useProStatus();
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const { lastSuccessfulScanAt, getTimeAgo } = useScannerStatus();
  const [trackedPermits, setTrackedPermits] = useState<TrackedPermitInfo[]>([]);
  const [proModalOpen, setProModalOpen] = useState(false);

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

  // Derive primary park — default to most recent active watcher's park
  const [selectedParkId, setSelectedParkId] = useState<string | null>(
    () => {
      if (firstSession?.parkId) return firstSession.parkId;
      // Sort by created_at descending to get most recent watcher
      if (trackedPermits.length > 0) {
        const sorted = [...trackedPermits].sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        return sorted[0].park_id;
      }
      return null;
    }
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

      const content = `Watching ${fs.parkName} permits. Ask me anything about your trip.`;

      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content };
    }

    // ── Standard greeting ──
    if (trackedPermits.length > 0) {
      // Use most recently created watcher
      const sorted = [...trackedPermits].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      const latest = sorted[0];
      const latestParkName = PARKS[latest.park_id]?.shortName || "your park";
      const body = `Watching ${latestParkName} permits. Ask me anything about your trip.`;
      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content: body };
    }

    const greeting = firstName
      ? `Hey ${firstName} — I'm Poko, your park ranger. What park are you planning to visit?`
      : "Hey — I'm Poko, your park ranger. What park are you planning to visit?";
    sessionStorage.setItem(SESSION_KEY, "true");
    return { id: 1, role: "assistant", content: greeting };
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

      // Update selectedParkId to most recent watcher's park if user hasn't manually switched
      if (trackedChanged && trackedPermits.length > 0 && !selectedParkId) {
        const sorted = [...trackedPermits].sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        setSelectedParkId(sorted[0].park_id);
      }

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
    if (!isPro) setQuestionsUsed((prev) => prev + 1);
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
      console.error("[poko-chat] client error:", e.name, e.message);
      if (e.message === "daily_cap" || e.message === "rate_limit") {
        // Inject inline upgrade card for 429 errors
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 2, role: "assistant", content: "", isRateLimitCard: true },
        ]);
      } else {
        let errorMsg: string;
        if (e.name === "AbortError") {
          errorMsg = "Response timed out — try again in a moment.";
        } else if (e.message === "server_error") {
          errorMsg = "Poko ran into a problem. Wait a moment and try again — if it keeps happening, reload the page.";
        } else if (e.message === "auth_required") {
          errorMsg = "You need to be signed in to chat with Poko.";
        } else if (!navigator.onLine) {
          errorMsg = "You seem to be offline. Check your connection and try again.";
        } else {
          errorMsg = "Poko ran into a problem. Wait a moment and try again — if it keeps happening, reload the page.";
        }
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 2, role: "assistant", content: errorMsg },
        ]);
      }
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
      setChipsHidden(false);
      // Sanitize + check if last assistant message contains permit availability language
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "assistant" && !lastMsg.isRateLimitCard) {
          const sanitized = sanitizeMochiResponse(lastMsg.content);
          const disclaimer = shouldShowDisclaimer(lastMsg.content);
          const updated = prev.map((m) =>
            m.id === lastMsg.id ? { ...m, content: sanitized, hasDisclaimer: disclaimer } : m
          );
          const lower = sanitized.toLowerCase();
          const isPermitRelated = PERMIT_KEYWORDS.some((kw) => lower.includes(kw));
          setMochiPose(isPermitRelated ? "celebrating" : "idle");
          if (isPermitRelated) {
            setTimeout(() => setMochiPose("idle"), 5000);
          }
          return updated;
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
          background: isDark ? "transparent" : "var(--wa-cream)",
          borderTop: isDark ? undefined : "1px solid var(--wa-rule)",
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
            placeholder="Ask about any park or permit..."
            aria-label="Ask Poko anything"
            className={isDark ? "mochi-dark-input" : "mochi-light-input"}
            style={
              isDark
                ? {
                    flex: 1,
                    background: "transparent",
                    fontSize: 15,
                    fontFamily: "'DM Sans', sans-serif",
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
                    color: "var(--wa-ink)",
                    outline: "none",
                    border: "none",
                    minWidth: 0,
                  }
            }
            disabled={isLoading}
          />
          <style>{`
            .mochi-light-composer:focus-within {
              border-color: var(--wa-green) !important;
              transition: border-color 0.18s ease;
            }
            .mochi-light-composer input::placeholder {
              color: var(--wa-ink-placeholder);
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
          <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: '#9CA3AF', textAlign: 'center', padding: '4px 20px 12px', lineHeight: 1.5, margin: 0 }}>
            Poko can make mistakes. Always verify permits and trail conditions at nps.gov and recreation.gov.
          </p>
        )}
        {!isPro && questionsUsed > 0 && (
          <p style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', margin: '2px 20px 8px', lineHeight: 1.4 }}>
            {5 - questionsUsed > 0 ? (
              <span style={{ color: '#9CA3AF' }}>{5 - questionsUsed} question{5 - questionsUsed !== 1 ? 's' : ''} remaining today</span>
            ) : (
              <span
                style={{ color: '#2F6F4E', cursor: 'pointer' }}
                onClick={() => setProModalOpen(true)}
                role="button"
                tabIndex={0}
              >
                Upgrade to Pro for unlimited questions
              </span>
            )}
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
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className="shrink-0" style={{ color: '#A8C4B8' }} strokeWidth={1.5} />
                  <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#F5F0E8', whiteSpace: 'nowrap', display: 'block' }}>{prompt.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>{prompt.descriptor}</span>
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
        background: isBriefing ? 'var(--wa-surface-sand)' : undefined,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        position: 'relative',
      }}
    >
      {/* Header — briefing: none / conversation: Mochi avatar */}
      {isBriefing ? null : (
        <div className="px-5 pt-4 pb-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--wa-rule)' }}>
          <div className="w-10 h-10 rounded-full border border-border/40 flex items-center justify-center overflow-hidden" style={{ background: 'var(--wa-cream)' }}>
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
            <p style={{ fontSize: 15, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: 'var(--wa-ink)', margin: 0 }}>Poko</p>
            <p style={{ fontSize: 11, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", color: 'var(--wa-ink-muted)', margin: 0 }}>your park companion</p>
          </div>
        </div>
      )}




      {isBriefing ? (
        <div className="flex-1 min-h-0 flex flex-col relative" style={{ background: 'var(--wa-surface-sand)' }}>
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

            {/* Sun glow removed — replaced by pulsing dot in topbar */}

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
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wa-green)', flexShrink: 0, willChange: 'transform', animation: 'permit-pulse 2s ease-in-out infinite' }} />
                <span>{(() => { const n = trackedParksUnique.length > 0 ? trackedParksUnique.length : Object.keys(PARKS).length; return `${n} PARK${n === 1 ? '' : 'S'} · LIVE`; })()}</span>
              </div>
            </div>

            {/* Park context pill */}
            {selectedParkId && PARKS[selectedParkId] && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, flexShrink: 0 }}
              >
                <ParkSelector
                  activeParkId={selectedParkId}
                  onParkChange={(id) => { setSelectedParkId(id); localStorage.setItem("wildatlas_active_park", id); }}
                  variant="default"
                />
              </motion.div>
            )}

            {/* Hero — orb + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px 0', flexShrink: 0, marginTop: 'auto' }}>
              <style>{`
                @keyframes permit-pulse {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.4; transform: scale(1.4); }
                }
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
              <div style={{ marginBottom: 0 }}>
                <img src={mochiWaveImg} alt="Poko" className="mochi-orb-breathe" style={{ width: 'auto', height: 140, objectFit: 'contain', objectPosition: 'center bottom', marginLeft: 28 }} />
              </div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 300, letterSpacing: '-0.02em', color: '#1A1A1A', lineHeight: 1.05, margin: 0, marginBottom: 12, borderBottom: 'none' }}>Poko</h1>
            </div>

            {/* Scrollable chat content */}
            <div
              ref={scrollRef}
              data-tab-scroll
              style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 0, paddingLeft: 16, paddingRight: 16, paddingBottom: 0, position: 'relative', minHeight: 0, scrollbarWidth: 'none' as const }}
            >
              {/* Chat bubbles — assistant (cream, left) and user (green, right) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                {messages.map((msg, idx) => {
                  const isAssistant = msg.role === 'assistant';
                  const isFirst = idx === 0 || messages[idx - 1].role !== msg.role;
                  if (msg.isRateLimitCard) {
                    return (
                      <div key={msg.id} className="mochi-fade-up" style={{ animationDelay: `${idx * 0.12}s`, maxWidth: '85%', alignSelf: 'center', marginLeft: 4, marginRight: 4, marginTop: idx === 0 ? 0 : 4 }}>
                        <RateLimitUpgradeCard onUpgrade={() => setProModalOpen(true)} />
                      </div>
                    );
                  }
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
                        padding: '14px 18px', fontSize: 15, fontWeight: 400,
                        fontFamily: "'DM Sans', sans-serif", color: 'var(--wa-ink-warm)', lineHeight: 1.7,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                      } : {
                        background: 'rgba(47, 111, 78, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: 'var(--wa-cream)',
                        borderRadius: '18px 10px 18px 18px',
                        padding: '11px 15px', fontSize: 13, fontWeight: 300,
                        fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                      }}>
                        {isAssistant
                          ? <div className="mochi-prose"><ReactMarkdown components={MARKDOWN_NO_TABLES}>{formatInlineBullets(stripMarkdownTables(msg.content))}</ReactMarkdown></div>
                          : msg.content}
                      </div>
                      {isAssistant && msg.hasDisclaimer && <InlineDisclaimer />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Composer wrapper — chips pinned above input */}
            <div style={{ flexShrink: 0, background: '#1A2F1E', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Pinned chip strip — contextual after first exchange, briefing before */}
              {!chipsHidden && !isLoading && messages[messages.length - 1]?.role === "assistant" && (() => {
                const hasUserMessage = messages.some((m) => m.role === "user");
                if (hasUserMessage) {
                  const lastReply = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
                  const watches: UserWatch[] = trackedPermits.map((p) => ({ park_id: p.park_id, permit_name: p.permit_name }));
                  const chips = getSuggestedChips(lastReply, watches, quickParkName === "the parks" ? null : quickParkName);
                  if (chips.length > 0) {
                    return (
                      <div style={{ flexShrink: 0, padding: '0 16px 4px', marginTop: 8 }}>
                        {renderChipRow(chips)}
                      </div>
                    );
                  }
                  return null;
                }
                // Briefing chips for initial greeting (no user message yet)
                return (
                  <div style={{ position: 'relative', marginLeft: 16, marginRight: 16, marginTop: 8 }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
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
                            fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif",
                            color: '#F5F0E8', background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.15)', padding: '10px 14px',
                            borderRadius: 16, cursor: 'pointer',
                            letterSpacing: '0.01em', lineHeight: 1.4,
                            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ padding: `10px 16px ${composerBottomPadding}`, transition: 'padding-bottom 0.22s ease-out' }}>
              <div
                className="mochi-input-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '0.5px solid rgba(255,255,255,0.15)',
                  borderRadius: 28,
                  padding: '9px 8px 9px 16px',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Ask about any park or permit..."
                  aria-label="Ask Poko"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 300,
                    color: '#F5F0E8',
                    outline: 'none',
                    padding: '3px 0',
                    minWidth: 0,
                  }}
                  disabled={isLoading}
                />
                <style>{`.mochi-input-pill input::placeholder { color: rgba(255,255,255,0.5) !important; }`}</style>
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
                    <Loader2 size={14} className="animate-spin" style={{ color: 'white' }} />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 11L11 6L1 1v3.8l6.5 1.2L1 7.2V11z" fill="white"/>
                    </svg>
                  )}
                </button>
              </div>
              <p style={{ fontSize: 11, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: 'rgba(255,255,255,0.3)', textAlign: 'center', margin: '6px 20px 0', lineHeight: 1.4 }}>
                Poko can make mistakes. Always verify permits and trail conditions at nps.gov and recreation.gov.
              </p>
              {!isPro && questionsUsed > 0 && (
                <p style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', margin: '4px 20px 6px', lineHeight: 1.4 }}>
                  {5 - questionsUsed > 0 ? (
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{5 - questionsUsed} question{5 - questionsUsed !== 1 ? 's' : ''} remaining today</span>
                  ) : (
                    <span
                      style={{ color: '#A8C4B8', cursor: 'pointer' }}
                      onClick={() => setProModalOpen(true)}
                      role="button"
                      tabIndex={0}
                    >
                      Upgrade to Pro for unlimited questions
                    </span>
                  )}
                </p>
              )}
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
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wa-ink-muted)', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: 'var(--wa-ink-muted)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{msg.content}</p>
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
                  className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"}`}
                  style={{ marginTop, marginBottom: isLastInGroup ? 0 : 0 }}
                >
                  {msg.isRateLimitCard ? (
                    <RateLimitUpgradeCard onUpgrade={() => setProModalOpen(true)} />
                  ) : (
                    <>
                      <div
                        style={
                          msg.role === "assistant"
                            ? {
                                maxWidth: '84%',
                                background: 'rgba(244, 238, 228, 0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                                border: '0.5px solid rgba(195, 178, 152, 0.45)',
                                borderLeft: isDense ? '2px solid var(--wa-green-light)' : '0.5px solid rgba(195, 178, 152, 0.45)',
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
                                color: 'var(--wa-cream)',
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
                      {msg.role === "assistant" && msg.hasDisclaimer && <InlineDisclaimer />}
                    </>
                  )}
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
            <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to bottom, rgba(232,226,217,0), var(--wa-surface-sand))', pointerEvents: 'none', zIndex: 2 }} />
          </div>

          {/* Dark bottom bar wrapping chips + composer */}
          <div style={{ flexShrink: 0, background: '#1A2F1E' }}>
            {/* Chip row — outside scroll, directly above input */}
            {!isLoading && !chipsHidden && messages[messages.length - 1]?.role === "assistant" && (() => {
              const lastReply = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
              const watches: UserWatch[] = trackedPermits.map((p) => ({ park_id: p.park_id, permit_name: p.permit_name }));
              const chips = getSuggestedChips(lastReply, watches, quickParkName === "the parks" ? null : quickParkName);
              return <div style={{ flexShrink: 0, padding: '0 16px 12px' }}>{renderChipRow(chips)}</div>;
            })()}

            {renderComposer({ tone: "dark", showDisclaimer: true })}
          </div>

          {/* Keyboard spacer — only when keyboard is open */}
          <div style={{ flexShrink: 0, height: keyboardInset > 0 ? keyboardInset + 8 : 0, background: '#1A2F1E', transition: 'height 0.22s ease-out', overflow: 'hidden' }} />
        </div>
      )}
      <ProModal open={proModalOpen} onOpenChange={setProModalOpen} />
    </div>
  );
};

export default MochiChat;

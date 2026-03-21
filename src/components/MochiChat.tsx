import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, BarChart3, Leaf, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MochiTrailCard, { parseTrailBlocks } from "@/components/MochiTrailCard";
import MochiScannerBanner from "@/components/MochiScannerBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import posthog from "@/lib/posthog";

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
        <img src={src} alt="Mochi" className="drop-shadow-md" style={imgStyle} />
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

type ChipTopic = "crowds" | "trails" | "weather" | "permits" | "wildlife" | "camping" | "general";

const TOPIC_CHIPS: Record<ChipTopic, string[]> = {
  crowds: ["Crowd level", "Parking", "Peak hours"],
  trails: ["Trail picks", "Difficulty", "Trailhead timing"],
  weather: ["Weather outlook", "Packing list", "Trail conditions"],
  permits: ["Permit drops", "Best time", "Permit tips"],
  wildlife: ["Wildlife spots", "Safety tips", "Best viewing"],
  camping: ["Camp permits", "Site forecast", "Packing list"],
  general: ["Permit tips", "Crowd level", "Trail picks"],
};

const CHIP_DESCRIPTORS: Record<string, string> = {
  "Permit drops": "Low availability",
  "Permit tips": "Low availability",
  "Permit chances": "Low availability",
  "Check times": "Low availability",
  "Crowd level": "Moderate now",
  "Crowd levels": "Moderate now",
  "Crowd forecast": "Moderate now",
  "Best time": "Tomorrow 7–9 AM",
  "Trail picks": "Top 3 picks",
  "Peak hours": "9 AM – 5 PM",
  "Trailhead timing": "Fills by 8:30",
  "Trailhead info": "Fills by 8:30",
  "Parking": "Fills by 8:30",
  "Parking tips": "Fills by 8:30",
  "Difficulty": "Varies by trail",
  "Difficulty guide": "Varies by trail",
  "Permits 101": "How it works",
  "Tracked parks": "8 parks live",
};

const TOPIC_PATTERNS: [ChipTopic, RegExp][] = [
  ["crowds", /\b(crowd|busy|packed|quiet|manageable|wait time|congest|peak hour|less busy|parking lot|shuttle)\b/i],
  ["trails", /\b(trail|hike|hiking|route|trailhead|summit|elevation|switchback|loop|out-and-back|mile)\b/i],
  ["weather", /\b(weather|temperature|rain|snow|forecast|wind|storm|sunshine|degrees|cold|warm)\b/i],
  ["permits", /\b(permit|reservation|cancel|availability|rec\.gov|recreation\.gov|lottery|booking)\b/i],
  ["wildlife", /\b(bear|wildlife|animal|elk|deer|moose|bird|marmot|mountain lion)\b/i],
  ["camping", /\b(camp|campsite|campground|tent|rv|backcountry camp)\b/i],
];

const RECENT_CHIPS_LIMIT = 3;
const CHIP_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "for",
  "in",
  "on",
  "of",
  "my",
  "me",
  "tell",
  "about",
  "what",
  "when",
  "best",
  "time",
  "today",
  "this",
  "that",
  "park",
]);

const normalizeForMatch = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeForMatch = (text: string): string[] =>
  normalizeForMatch(text)
    .split(" ")
    .filter((token) => token.length > 2 && !CHIP_STOP_WORDS.has(token));

const detectTopic = (text: string): ChipTopic => {
  let best: ChipTopic = "general";
  let bestCount = 0;
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    const matches = text.match(new RegExp(pattern, "gi"));
    if (matches && matches.length > bestCount) {
      bestCount = matches.length;
      best = topic;
    }
  }
  return best;
};

const isSemanticallySimilarToLastUserMessage = (chipLabel: string, lastUserMessage?: string): boolean => {
  if (!lastUserMessage?.trim()) return false;

  const chipNormalized = normalizeForMatch(chipLabel);
  const userNormalized = normalizeForMatch(lastUserMessage);

  if (!chipNormalized || !userNormalized) return false;
  if (chipNormalized === userNormalized) return true;
  if (chipNormalized.includes(userNormalized) || userNormalized.includes(chipNormalized)) return true;

  const chipTopic = detectTopic(chipLabel);
  const userTopic = detectTopic(lastUserMessage);
  if (chipTopic !== "general" && chipTopic === userTopic) return true;

  const chipTokens = tokenizeForMatch(chipLabel);
  const userTokens = tokenizeForMatch(lastUserMessage);
  if (!chipTokens.length || !userTokens.length) return false;

  const userTokenSet = new Set(userTokens);
  const overlap = chipTokens.filter((token) => userTokenSet.has(token)).length;
  return overlap / Math.min(chipTokens.length, userTokens.length) >= 0.5;
};

const applyPark = (chips: string[], parkName: string): string[] =>
  chips.map((c) => c.replace(/\{park\}/g, parkName));

/** All unique chip templates across every topic, used as a fallback pool */
const ALL_CHIP_TEMPLATES = [...new Set(Object.values(TOPIC_CHIPS).flat())];

const getContextualChips = (
  lastAssistantContent: string | undefined,
  recentlyUsed: string[],
  parkName: string,
  lastUserMessage?: string,
  targetCount = 3,
): string[] => {
  const topic = lastAssistantContent ? detectTopic(lastAssistantContent) : "general";
  const primaryTemplates = TOPIC_CHIPS[topic];
  const recentSet = new Set(recentlyUsed);
  const shouldExclude = (chip: string) =>
    recentSet.has(chip) || isSemanticallySimilarToLastUserMessage(chip, lastUserMessage);

  const primary = [...new Set(applyPark(primaryTemplates, parkName))].filter((chip) => !shouldExclude(chip));

  if (primary.length >= targetCount) return primary.slice(0, targetCount);

  // Back-fill from other topics, excluding recent and already-picked chips
  const picked = new Set(primary);
  const pool = [...new Set(applyPark(ALL_CHIP_TEMPLATES, parkName))].filter(
    (chip) => !shouldExclude(chip) && !picked.has(chip),
  );

  const result = [...primary];
  for (const chip of pool) {
    if (result.length >= targetCount) break;
    result.push(chip);
  }

  return result;
};
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

const MochiChat = ({ onNavigateToDiscover, onNavigateToAlerts }: { onNavigateToDiscover?: (parkId: string) => void; onNavigateToAlerts?: () => void }) => {
  const { displayName, user } = useAuth();
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

  // Derive primary park from tracked permits (Mochi is independent of Discover's park selection)
  const primaryParkId = firstSession?.parkId || trackedPermits[0]?.park_id || "yosemite";

  const makeGreeting = (): Message => {
    const firstName = displayName?.trim().split(/\s+/)[0] || "";
    const { label: timeLabel, casual: timeCasual } = getTimePeriod();
    const parkName = PARKS[primaryParkId]?.shortName || "the parks";

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
    const primaryParkPermits = trackedPermits.filter((p) => p.park_id === primaryParkId);

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
        ? `Watching ${permitNames} in ${parkName}\n\n${checksLine} scans · No openings yet\n\nBest odds: early morning`
        : `Watching ${permitNames} in ${parkName}\n\nNo openings yet · Scanning now\n\nBest odds: early morning`;
    } else if (trackedPermits.length > 0) {
      body = `Monitoring ${trackedPermits.length} permit${trackedPermits.length > 1 ? "s" : ""} for you right now.\n${checksLine} — no availability yet\nBest odds are early morning`;
    } else {
      body = "What park are you heading to?";
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
  const [recentChips, setRecentChips] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPrimaryParkRef = useRef(primaryParkId);
  const sendTimestamps = useRef<number[]>([]);
  const pendingSendRef = useRef<string | null>(null);

  // Update greeting when primary park changes (from tracked permits)
  useEffect(() => {
    if (primaryParkId !== prevPrimaryParkRef.current) {
      prevPrimaryParkRef.current = primaryParkId;
      const isBriefingState = messages.length <= 2 && messages[0]?.id === 1;
      if (isBriefingState && !firstSession) {
        setMessages([makeGreeting()]);
      }
    }
  }, [primaryParkId]);

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
        { id: now, role: "assistant", content: "Whoa, slow down! 🐻 Let me catch my breath. Try again in 15 seconds." },
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
        body: JSON.stringify({ messages: history, arrivalDate, parkId: primaryParkId }),
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
        errorMsg = "🐻 Response timed out — try again in a moment.";
      } else if (e.message === "daily_cap") {
        errorMsg = "You've hit your daily Mochi limit 🐻 Upgrade to Pro for unlimited chats!";
      } else if (e.message === "rate_limit") {
        errorMsg = "Too many questions at once 🐻 Give it 15 seconds and try again.";
      } else if (e.message === "server_error") {
        errorMsg = "Something went wrong. Try asking again.";
      } else if (e.message === "auth_required") {
        errorMsg = "You need to sign in before chatting with Mochi 🐻 Log in and try again.";
      } else if (!navigator.onLine) {
        errorMsg = "You seem to be offline 🐻 Check your connection and try again.";
      } else {
        errorMsg = "Something went wrong. Try asking again.";
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

  const isBriefing = messages.length <= 2 && messages[0]?.id === 1;

  const handleChipTap = useCallback((chipLabel: string) => {
    setRecentChips((prev) => [...prev.slice(-(RECENT_CHIPS_LIMIT - 1)), chipLabel]);
    setChipsHidden(true);
    setInput(chipLabel);
  }, []);

  // Park-aware quick prompts based on tracked permits
  const quickParkName = PARKS[primaryParkId]?.shortName || "the parks";
  const primaryParkPermits = trackedPermits.filter((p) => p.park_id === primaryParkId);
  const primaryPermit = firstSession?.permitName || primaryParkPermits[0]?.permit_name || trackedPermits[0]?.permit_name;
  const recentChipsarray = recentChips.slice(-RECENT_CHIPS_LIMIT);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content;

  const quickPrompts = [
    { label: "Permit chances", descriptor: "Forecast", icon: BarChart3 },
    { label: "Crowd level", descriptor: "Busy now", icon: Leaf },
    { label: "Best time", descriptor: "Tomorrow", icon: Clock },
  ];

  const renderChipRow = (prompts: { label: string; descriptor: string; icon: typeof BarChart3 }[]) => (
    <div className="flex gap-2" style={{ padding: '0 16px' }}>
      {prompts.map((prompt, i) => {
        const Icon = prompt.icon;
        return (
          <motion.button
            key={prompt.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            transition={{ delay: 0.1 + i * 0.04 }}
            onClick={() => handleChipTap(prompt.label)}
            className="flex-1 min-w-0 rounded-2xl px-2 py-2.5 flex items-center gap-1.5 transition-colors duration-150 border border-border/50 bg-background hover:bg-muted/40"
          >
            <Icon size={14} className="text-secondary shrink-0" strokeWidth={2} />
            <div className="text-left min-w-0 overflow-hidden">
              <p className="font-semibold text-foreground/80 leading-tight truncate" style={{ fontSize: 'clamp(12px, 2.8vw, 13px)' }}>{prompt.label}</p>
              <p className="text-muted-foreground leading-tight mt-0.5 truncate" style={{ fontSize: 'clamp(9px, 2.2vw, 10px)' }}>{prompt.descriptor}</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  // Get unique tracked parks (id + name) for the monitoring indicator
  const trackedParksUnique = [...new Map(
    trackedPermits.map((p) => [p.park_id, { id: p.park_id, name: PARKS[p.park_id]?.shortName }])
  ).values()].filter((p) => p.name);

  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center overflow-hidden">
          <motion.img
            key={mochiPose}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            src={mochiPose === "scanning" ? MOCHI_SCANNING : mochiPose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_IDLE}
            alt="Mochi"
            className="w-8 h-8 object-contain object-center"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-gold tracking-widest uppercase">Park Guide</p>
          {!isBriefing && <p className="text-[11px] text-gold/60 font-medium">Mochi</p>}
        </div>
      </div>

      {/* Monitoring indicator - only show when tracking permits */}
      {trackedParksUnique.length > 0 && isBriefing && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-scanning opacity-50" style={{ animationDuration: "1.6s" }} />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-scanning" />
            </span>
            <span className="text-[11px] text-muted-foreground/70 font-medium">Monitoring</span>
            {trackedParksUnique.map((park) => (
              <button
                key={park.id}
                onClick={() => onNavigateToDiscover?.(park.id)}
                className="text-[10px] font-semibold text-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full active:scale-95 transition-all duration-150 hover:bg-muted/80"
              >
                {park.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live scanner status banner — always visible above chat */}
      <MochiScannerBanner
        trackedPermits={trackedPermits}
        onTap={() => {
          if (trackedPermits.length > 0) {
            onNavigateToAlerts?.();
          } else {
            onNavigateToDiscover?.(primaryParkId);
          }
        }}
      />

      <div ref={scrollRef} className="pb-2" data-tab-scroll>
        {/* ── Briefing view ── */}
        {isBriefing && (
          <div className="px-5 flex flex-col">
            {/* Mochi illustration + title group — only shown when no LIVE card */}
            {trackedPermits.length === 0 && (
              <div className="flex flex-col items-center mx-auto" style={{ marginTop: 20 }}>
                <div className="flex justify-center items-end mx-auto" style={{ height: 80, width: 80 }}>
                  <MochiHeroImage pose={mochiPose} size={80} />
                </div>
                <h1 className="text-[22px] font-heading font-bold text-foreground leading-tight text-center" style={{ marginTop: 12 }}>Mochi</h1>
                <p className="text-[12px] text-muted-foreground/60 mt-1 font-medium text-center">Real-time permit intelligence</p>
              </div>
            )}


            {/* Initial greeting card — conversational chat bubble */}
            <AnimatePresence mode="wait">
              <motion.div
                key={messages[0]?.content}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-muted/40 border border-border/50 rounded-2xl px-5 py-5 mb-3"
                style={{ boxShadow: "var(--card-shadow)" }}
              >
                <p className="text-[14px] font-body font-medium text-foreground leading-snug whitespace-pre-line">
                  {messages[0].content}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Suggestion chips */}
            {!chipsHidden && renderChipRow(quickPrompts)}
          </div>
        )}

        {/* ── Conversation view ── */}
        {!isBriefing && (
          <div className="px-5 space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] text-[13px] leading-[1.75] ${
                    msg.role === "assistant"
                      ? "bg-muted/40 text-card-foreground border border-border/50 rounded-2xl rounded-tl-lg px-4 py-4 shadow-sm"
                      : "bg-primary text-primary-foreground rounded-2xl rounded-tr-lg px-4 py-3.5 shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <img src={MOCHI_IDLE} alt="Mochi" className="w-4 h-4 rounded-full opacity-80" />
                      <span className="text-[9px] font-bold text-secondary/60 uppercase tracking-wider">Mochi</span>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="mochi-prose space-y-3">
                      {parseTrailBlocks(msg.content).map((block, bi) =>
                        block.type === "trails" ? (
                          <div key={bi} className="space-y-2 -mx-1">
                            {block.value.map((trail, ti) => (
                              <MochiTrailCard key={ti} trail={trail} />
                            ))}
                          </div>
                        ) : (
                          <div key={bi}><ReactMarkdown>{formatInlineBullets(block.value)}</ReactMarkdown></div>
                        )
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}

            {/* Suggestion chips after last assistant message */}
            {!isLoading && !chipsHidden && messages[messages.length - 1]?.role === "assistant" && (() => {
              const chips = getContextualChips(
                messages.filter((m) => m.role === "assistant").pop()?.content,
                recentChipsarray,
                quickParkName,
                lastUserMessage,
              );
              const fallbackPrompts = [
                { label: "Permit chances", descriptor: "Forecast", icon: BarChart3 },
                { label: "Crowd level", descriptor: "Busy now", icon: Leaf },
                { label: "Best time", descriptor: "Tomorrow", icon: Clock },
              ];
              const iconPool = [BarChart3, Leaf, Clock];
              const descPool = ["Forecast", "Explore", "Timing"];
              const mappedPrompts = chips.slice(0, 3).map((chip, i) => ({
                label: chip,
                descriptor: descPool[i % descPool.length],
                icon: iconPool[i % iconPool.length],
              }));
              while (mappedPrompts.length < 3) {
                const idx = mappedPrompts.length;
                const fb = fallbackPrompts[idx % fallbackPrompts.length];
                if (!mappedPrompts.some((p) => p.label === fb.label)) {
                  mappedPrompts.push(fb);
                } else {
                  // Use a generic fallback to guarantee we reach 3
                  mappedPrompts.push({ label: `${quickParkName} tips`, descriptor: "Guide", icon: Leaf });
                  break;
                }
              }
              return renderChipRow(mappedPrompts);
            })()}
          </div>
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2 }}
              className="flex justify-start px-5 mt-3"
            >
              <div className="bg-muted/40 border border-border/50 rounded-2xl rounded-tl-lg px-4 py-3.5 shadow-sm flex items-center gap-2.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.6s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "0.6s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "0.6s" }} />
                </div>
                <span className="text-[10px] text-muted-foreground/60 font-medium">Mochi is thinking…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky chat input + disclaimer */}
      <div className="sticky bottom-0 z-10 bg-background border-t border-border/60 px-5 pt-2.5 pb-3">
        <p className="text-[10px] font-medium text-muted-foreground/45 mb-1 ml-1">Ask Mochi</p>
        <div className="flex items-center gap-2 bg-card border border-border rounded-[18px] px-4 py-2.5" style={{ boxShadow: "0 -2px 12px -4px hsl(var(--foreground) / 0.06)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about permits, crowds, or entry strategy..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center px-4 pt-1 pb-0 leading-snug">
          Mochi gives general park guidance. Verify rules, conditions, and closures with official park sources before your visit.
        </p>
      </div>
    </div>
  );
};

export default MochiChat;

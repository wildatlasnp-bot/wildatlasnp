import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, BarChart3, Leaf, Clock, Mountain, ArrowUp, Compass } from "lucide-react";
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

type ChipTopic = "crowds" | "trails" | "weather" | "permits" | "wildlife" | "camping" | "general";
type ChipType = { label: string; descriptor: string; icon: typeof BarChart3 };

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
  "Permit drops": "When do they appear?",
  "Permit tips": "How do I snag one?",
  "Permit odds": "What are my chances?",
  "Check times": "When should I check?",
  "Crowd level": "How busy is it?",
  "Crowd levels": "How busy is it?",
  "Crowd forecast": "What's it look like?",
  "Best time": "When should I go?",
  "Trail picks": "Show me options",
  "Peak hours": "When's it busiest?",
  "Trailhead timing": "Best time to arrive?",
  "Trailhead info": "What should I know?",
  "Parking": "Where do I park?",
  "Parking tips": "Where do I park?",
  "Difficulty": "How hard is it?",
  "Difficulty guide": "How hard is it?",
  "Permits 101": "How does it work?",
  "Tracked parks": "Which parks are live?",
  "Weather outlook": "What's the forecast?",
  "Packing list": "What should I bring?",
  "Trail conditions": "Is it passable?",
  "Wildlife spots": "Where to look?",
  "Safety tips": "What should I know?",
  "Best viewing": "When to spot them?",
  "Camp permits": "How do I get one?",
  "Site forecast": "What's it look like?",
};

/** Logical follow-up topics for each covered topic, in priority order */
const FOLLOW_UP_MAP: Record<ChipTopic, ChipTopic[]> = {
  permits:  ["crowds",  "trails",  "weather", "wildlife", "camping"],
  crowds:   ["trails",  "permits", "weather", "wildlife", "camping"],
  trails:   ["weather", "crowds",  "wildlife","permits",  "camping"],
  weather:  ["trails",  "crowds",  "camping", "permits",  "wildlife"],
  wildlife: ["trails",  "weather", "crowds",  "camping",  "permits"],
  camping:  ["permits", "trails",  "weather", "crowds",   "wildlife"],
  general:  ["permits", "crowds",  "trails",  "weather",  "wildlife"],
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

const detectParkInText = (text: string): string | null => {
  const lower = text.toLowerCase();
  for (const park of Object.values(PARKS)) {
    if (park.shortName && lower.includes(park.shortName.toLowerCase())) {
      return park.shortName;
    }
  }
  return null;
};

const getContextualChips = (replyText: string, currentPark: string | null): ChipType[] => {
  const iconPool = [BarChart3, Leaf, Clock] as const;

  // 1. Detect all topics covered by the reply
  const covered = new Set<ChipTopic>();
  let primaryTopic: ChipTopic = "general";
  let bestCount = 0;
  for (const [topic, pattern] of TOPIC_PATTERNS) {
    const matches = replyText.match(new RegExp(pattern.source, "gi"));
    if (matches) {
      covered.add(topic);
      if (matches.length > bestCount) { bestCount = matches.length; primaryTopic = topic; }
    }
  }

  // 2. Detect park: prefer a name found in the reply, fall back to currentPark
  const park = detectParkInText(replyText) ?? currentPark;

  // 3. Pick chips from follow-up topics (never the covered topic)
  const followUps = FOLLOW_UP_MAP[primaryTopic];
  const result: ChipType[] = [];
  const usedLabels = new Set<string>();

  for (const topic of followUps) {
    if (covered.has(topic)) continue;
    for (const chipLabel of TOPIC_CHIPS[topic]) {
      if (usedLabels.has(chipLabel)) continue;
      usedLabels.add(chipLabel);
      result.push({ label: chipLabel, descriptor: CHIP_DESCRIPTORS[chipLabel] ?? chipLabel, icon: iconPool[result.length % 3] });
      if (result.length >= 3) break;
    }
    if (result.length >= 3) break;
  }

  // 4. Back-fill from any remaining templates if we didn't hit 3
  if (result.length < 3) {
    for (const chipLabel of ALL_CHIP_TEMPLATES) {
      if (usedLabels.has(chipLabel)) continue;
      usedLabels.add(chipLabel);
      result.push({ label: chipLabel, descriptor: CHIP_DESCRIPTORS[chipLabel] ?? chipLabel, icon: iconPool[result.length % 3] });
      if (result.length >= 3) break;
    }
  }

  // 5. Inject park name into the first chip if park context exists
  if (park && result.length > 0) {
    const first = result[0];
    result[0] = { ...first, label: `${first.label} at ${park}` };
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
  const [recentChips, setRecentChips] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPrimaryParkRef = useRef(selectedParkId);
  const sendTimestamps = useRef<number[]>([]);
  const pendingSendRef = useRef<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset > 80 ? inset : 0);
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("orientationchange", updateKeyboardInset);

    return () => {
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

  const isBriefing = messages.length <= 2 && messages[0]?.id === 1;
  const composerBottomPadding = `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset > 0 ? keyboardInset + 12 : 72}px)`;

  useEffect(() => {
    if (!isBriefing) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [keyboardInset, isBriefing]);

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
                  borderRadius: 14,
                  background: "#FFFFFF",
                  border: "1px solid #DDD9D4",
                  padding: "4px 4px 4px 18px",
                  position: "relative" as const,
                }
          }
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask Mochi anything..."
            aria-label="Ask Mochi anything"
            className={isDark ? "mochi-dark-input" : ""}
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
    setRecentChips((prev) => [...prev.slice(-(RECENT_CHIPS_LIMIT - 1)), chipLabel]);
    setChipsHidden(true);
    pendingSendRef.current = chipLabel;
    setInput(chipLabel);
  }, []);

  // Park-aware quick prompts based on tracked permits
  const quickParkName = PARKS[selectedParkId]?.shortName || "the parks";
  const primaryParkPermits = trackedPermits.filter((p) => p.park_id === selectedParkId);
  const primaryPermit = firstSession?.permitName || primaryParkPermits[0]?.permit_name || trackedPermits[0]?.permit_name;
  const recentChipsarray = recentChips.slice(-RECENT_CHIPS_LIMIT);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content;

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
                transition={{ delay: i * 0.05, duration: 0.25 }}
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
                  padding: '10px 12px',
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
        background: isBriefing ? '#F0EDEA' : undefined,
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
        <div className="flex-1 min-h-0 flex flex-col relative" style={{ background: '#F0EDEA' }}>

          <div
            ref={scrollRef}
            data-tab-scroll
            style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px 16px 0', gap: 10, position: 'relative', zIndex: 1, minHeight: 0 }}
          >
            <div className="mochi-fade-up" style={{ position: 'relative', alignSelf: 'center', animationDelay: '0s' }}>
              <img
                src={MOCHI_IDLE}
                alt=""
                aria-hidden="true"
                className="mochi-float"
                style={{ width: 108, height: 108, objectFit: 'contain', display: 'block', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.12))' }}
                loading="lazy"
              />
            </div>

            <div className="mochi-fade-up" style={{ textAlign: 'center', alignSelf: 'center' }}>
              <div className="mochi-fade-up" style={{ animationDelay: '0.1s' }}>
                <h1 style={{ fontSize: 32, fontWeight: 400, fontFamily: "'Cormorant Garamond', serif", color: '#1C1C19', margin: 0 }}>Mochi</h1>
              </div>
              <div className="mochi-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, animationDelay: '0.15s' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2F6F4E' }} aria-hidden="true" />
                <p style={{ fontSize: 12, fontWeight: 300, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', color: '#9A9289', margin: 0, textTransform: 'lowercase' }}>your park companion</p>
              </div>
            </div>

            <div className="mochi-fade-up" style={{ animationDelay: '0.2s', border: '1px solid #DDD9D4', borderRadius: 14, padding: '16px 18px', width: '100%', background: '#FFFFFF' }}>
              <p style={{ fontSize: 18, fontWeight: 400, fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif", color: '#1C1C19', lineHeight: 1.45, margin: '0 0 6px' }}>Which park should I head to this weekend?</p>
              <p style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: '#9A9289', margin: 0 }}>Just ask. I'll handle the rest.</p>
            </div>

            {!chipsHidden && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <motion.button
                  className="mochi-fade-up"
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  onClick={() => handleChipTap("Tracked parks: All parks live")}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChipTap("Tracked parks: All parks live"); } }}
                  style={{ animationDelay: '0.28s', background: '#FFFFFF', border: '1px solid #DDD9D4', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  tabIndex={0}
                  aria-label="8 parks tracked — all live"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2F6F4E', flexShrink: 0 }} aria-hidden="true" />
                      <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, color: '#2F6F4E', letterSpacing: '0.14em', textTransform: 'uppercase' }}>ACTIVE</span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#1C1C19', margin: '0 0 4px' }}>8 parks tracked</p>
                    <p style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: '#9A9289', margin: 0 }}>Yosemite · Zion · Rainier +5</p>
                  </div>
                  <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32, flexShrink: 0, marginLeft: 16 }}>
                    {[10,28,14,22,18,32,12,26,20,16,24,30].map((h, i) => (
                      <div key={i} style={{ width: 4, height: h, borderRadius: '4px 4px 0 0', background: '#2F6F4E', opacity: 0.5 }} />
                    ))}
                  </div>
                </motion.button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <motion.button
                    className="mochi-fade-up"
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={() => handleChipTap("Permit alerts: How do permit alerts work?")}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChipTap("Permit alerts: How do permit alerts work?"); } }}
                    style={{ animationDelay: '0.34s', background: '#FFFFFF', border: '1px solid #DDD9D4', borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left', cursor: 'pointer' }}
                    tabIndex={0}
                    aria-label="Permit alerts — scanning now"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#2F6F4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#2F6F4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#1C1C19', margin: '0 0 2px' }}>Permit alerts</p>
                      <p style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: '#9A9289', margin: '0 0 8px' }}>Scanning now</p>
                    </div>
                    <div style={{ background: '#EBF2EE', borderRadius: 20, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#2F6F4E' }} aria-hidden="true" />
                      <span style={{ fontSize: 10, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#2F6F4E' }}>Active</span>
                    </div>
                  </motion.button>

                  <motion.button
                    className="mochi-fade-up"
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={() => handleChipTap("Trail guide: Current trail conditions")}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChipTap("Trail guide: Current trail conditions"); } }}
                    style={{ animationDelay: '0.38s', background: '#FFFFFF', border: '1px solid #DDD9D4', borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, textAlign: 'left', cursor: 'pointer' }}
                    tabIndex={0}
                    aria-label="Trail guide — conditions live"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 19L9 8L13 14L16 10L21 19Z" stroke="#2F6F4E" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                    </svg>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#1C1C19', margin: '0 0 2px' }}>Trail guide</p>
                      <p style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", fontWeight: 300, color: '#9A9289', margin: 0 }}>Conditions live</p>
                    </div>
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {renderComposer({ tone: "light" })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" data-tab-scroll>
            <div className="px-5 space-y-3 py-4" aria-live="polite" aria-atomic="false" aria-relevant="additions">
              {messages.map((msg) => {
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
                return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    style={
                      msg.role === "assistant"
                        ? {
                            maxWidth: '85%',
                            background: '#FFFFFF',
                            border: '1px solid #DDD9D4',
                            borderRadius: '4px 14px 14px 14px',
                            padding: '14px 16px',
                            fontSize: 14,
                            fontWeight: 300,
                            fontFamily: "'DM Sans', sans-serif",
                            color: '#1C1C19',
                            lineHeight: 1.6,
                          }
                        : {
                            maxWidth: '80%',
                            background: '#2F6F4E',
                            color: '#F0EDEA',
                            borderRadius: '14px 4px 14px 14px',
                            padding: '14px 16px',
                            fontSize: 14,
                            fontWeight: 400,
                            fontFamily: "'DM Sans', sans-serif",
                            lineHeight: 1.6,
                          }
                    }
                  >
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
                );
              })}

              <AnimatePresence>
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-start"
                  >
                    <div style={{ background: '#FFFFFF', border: '1px solid #DDD9D4', borderRadius: '4px 14px 14px 14px', padding: '14px 16px' }} className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#9A9289', animationDelay: "0ms", animationDuration: "0.6s" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#9A9289', animationDelay: "150ms", animationDuration: "0.6s" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#9A9289', animationDelay: "300ms", animationDuration: "0.6s" }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: '#9A9289' }}>Mochi is thinking…</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Chip row — outside scroll, directly above input */}
          {!isLoading && !chipsHidden && messages[messages.length - 1]?.role === "assistant" && (() => {
            const lastReply = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
            const chips = getContextualChips(lastReply, quickParkName || null);
            return <div style={{ flexShrink: 0, paddingBottom: 8 }}>{renderChipRow(chips)}</div>;
          })()}

          {renderComposer({ tone: "light", showDisclaimer: true })}

          {/* Safe-area bottom spacer for bottom nav */}
          <div style={{ flexShrink: 0, height: `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset > 0 ? keyboardInset : 64}px)`, background: '#F0EDEA' }} />
        </div>
      )}
    </div>
  );
};

export default MochiChat;

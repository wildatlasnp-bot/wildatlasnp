import React, { useState, useRef, useEffect, useCallback } from "react";

import { Send, Loader2, BarChart3, Leaf, Clock, ArrowUp } from "lucide-react";
import { getSuggestedChips, type UserWatch } from "@/components/mochi/ChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import MochiTrailCard, { parseTrailBlocks } from "@/components/MochiTrailCard";
import PokoMapCard, { parseMapBlocks } from "@/components/poko/PokoMapCard";
import MochiScannerBanner from "@/components/MochiScannerBanner";
import MochiStatusCard from "@/components/MochiStatusCard";
import ProModal from "@/components/ProModal";
import ParkSelector from "@/components/ParkSelector";
import ScanningLedger from "@/components/poko/ScanningLedger";
import AssistantBubbleShell from "@/components/poko/AssistantBubbleShell";
import InlineDisclaimer from "@/components/mochi/InlineDisclaimer";
import RateLimitUpgradeCard from "@/components/mochi/RateLimitUpgradeCard";
import VisitWindowCard from "@/components/mochi/VisitWindowCard";
import MochiHeader from "@/components/mochi/MochiHeader";
import MochiComposer from "@/components/mochi/MochiComposer";
import MochiMessageList from "@/components/mochi/MochiMessageList";
import {
  PERMIT_KEYWORDS,
  stripMarkdownTables,
  sanitizeMochiResponse,
  shouldShowDisclaimer,
  formatInlineBullets,
  MARKDOWN_NO_TABLES,
} from "@/components/mochi/mochi-formatting";
import {
  type DispatchWindow,
  getDispatchWindow,
  IDLE_MESSAGES,
  RETURNING_MESSAGES,
  getSeasonalSubtitle,
  PERSONALITY_MARKER,
} from "@/components/mochi/mochi-greeting";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import { applyParkAccent } from "@/lib/park-accent";
import posthog from "@/lib/posthog";
import { haptics } from "@/lib/haptics";
import { useScannerStatus } from "@/hooks/useScannerStatus";
import { useStatusRowOpacity } from "@/hooks/useStatusRowOpacity";
import {
  pokoBubbleStyle,
  userBubbleStyle,
  typingBubbleStyle,
  typingDotStyle,
} from "@/components/poko/bubbleTokens";



// Mochi pose assets (public directory) — referenced by inline header avatar
const MOCHI_IDLE = "/mochi-neutral.png";
const MOCHI_SCANNING = "/mochi-compass.png";
const MOCHI_CELEBRATING = "/mochi-celebrate.png";

type MochiPose = "idle" | "scanning" | "celebrating";


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

    // ── First-session welcome (one-time after onboarding) ──
    if (firstSession && firstSession.permitName) {
      const fs = firstSession;
      const content = `Watching ${fs.parkName} permits. Ask me anything about your trip.`;
      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content };
    }

    // ── Time-aware dispatch (watched parks → most recent) ──
    let parkName: string | null = null;
    if (trackedPermits.length > 0) {
      const sorted = [...trackedPermits].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      parkName = PARKS[sorted[0].park_id]?.shortName || "your park";
    }

    const dispatch = getDispatchWindow(parkName);
    sessionStorage.setItem(SESSION_KEY, "true");
    return {
      id: 1,
      role: "assistant",
      content: `${dispatch.title} ${dispatch.body}`,
    };
  };

  const [messages, setMessages] = useState<Message[]>(() => [makeGreeting()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Streaming phase machine — drives the aurora wash with phase-specific
  // intensity instead of a single boolean flip. Transitions:
  //   idle → starting (request sent, awaiting first byte)
  //   starting → streaming (first token delta arrived)
  //   streaming → streaming (re-pulses on token bursts)
  //   * → finishing (stream completed or errored; ~600ms hold)
  //   finishing → idle (after hold)
  type StreamPhase = 'idle' | 'starting' | 'streaming' | 'finishing';
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle');
  // Token-burst pulse counter — increments on each delta to drive a brief
  // intensity bump on the aurora without re-rendering surrounding UI.
  const [tokenBurstTick, setTokenBurstTick] = useState(0);
  const lastBurstAtRef = useRef(0);
  const finishingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (finishingTimeoutRef.current) clearTimeout(finishingTimeoutRef.current);
  }, []);
  const [rateLimited, setRateLimited] = useState(false);
  const [mochiPose, setMochiPose] = useState<MochiPose>("idle");
  const [chipsHidden, setChipsHidden] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [briefingChipSetIdx, setBriefingChipSetIdx] = useState(0);
  const [usedBriefingChips, setUsedBriefingChips] = useState<Set<string>>(new Set());
  const briefingChipUsedCount = useRef(0);
  const briefingChipTotal = useRef(BRIEFING_CHIP_SETS[0].length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMountRef = useRef(true);
  // Tracks the message-list length as of the previous render. Anything from
  // this index onward is part of the most recent "burst" and receives the
  // 80ms-per-bubble entrance stagger. Older messages render with no delay
  // so re-renders deep in long threads never re-trigger animations.
  const prevMsgCountRef = useRef(1);
  const burstStartRef = useRef(1);
  const prevPrimaryParkRef = useRef(selectedParkId);
  const sendTimestamps = useRef<number[]>([]);
  const pendingSendRef = useRef<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const keyboardRafRef = useRef<number>(0);
  const initialQueryProcessed = useRef(false);

  // Explicit composer mode state — single source of truth for both the
  // status-row hook and any layout that branches on briefing vs conversation.
  type ComposerMode = 'briefing' | 'conversation';
  const deriveComposerMode = useCallback((msgs: typeof messages): ComposerMode => {
    return msgs.length <= 2 && msgs[0]?.id === 1 ? 'briefing' : 'conversation';
  }, []);
  const [composerMode, setComposerMode] = useState<ComposerMode>(() => deriveComposerMode(messages));
  useEffect(() => {
    const next = deriveComposerMode(messages);
    setComposerMode((prev) => (prev === next ? prev : next));
  }, [messages, deriveComposerMode]);
  const isBriefingMode = composerMode === 'briefing';

  // Status-row opacity controller — shared across both composers via a hook
  // so reset/debounce/snap behavior stays identical wherever it's mounted.
  const {
    statusOpacity,
    statusSnap,
    setScrollRef: setStatusScrollRef,
    handleChatScroll,
    activeScrollEl,
  } = useStatusRowOpacity({
    isLoading,
    composerMode,
    layoutSignal: messages,
    debugLabel: 'MochiChat',
  });

  // Bridge the hook's callback ref to the existing scrollRef so legacy
  // imperative APIs that need a stable ref (e.g. third-party libs) still
  // work — but all opacity/scroll logic in this component now reads from
  // `activeScrollEl` directly to avoid any chance of a stale ref read
  // during scroll-container re-attachment between briefing/conversation.
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setStatusScrollRef(el);
  }, [setStatusScrollRef]);

  // Handle initialQuery from external navigation (e.g. Discover trip card)
  useEffect(() => {
    if (initialQuery && !initialQueryProcessed.current) {
      initialQueryProcessed.current = true;
      pendingSendRef.current = initialQuery;
      setInput(initialQuery);
    }
  }, [initialQuery]);

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

  // Update greeting when primary park changes (from tracked permits).
  // Note: `messages` is intentionally read via the `isBriefingState` derivation
  // — including it in deps would cause this to refire on every chat turn and
  // wipe the conversation. We gate strictly on the park-id transition.
  useEffect(() => {
    if (selectedParkId !== prevPrimaryParkRef.current) {
      prevPrimaryParkRef.current = selectedParkId;
      const isBriefingState = messages.length <= 2 && messages[0]?.id === 1;
      if (isBriefingState && !firstSession) {
        setMessages([makeGreeting()]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParkId, firstSession, makeGreeting]);

  // Mirror Poko's selected park onto the document root so the --park-accent
  // atmosphere updates when the user changes parks via the Poko header.
  // (Index.tsx also pushes the accent on tab/parkId changes — these two
  // writers stay coherent because they target the same canonical key.)
  useEffect(() => {
    applyParkAccent(selectedParkId);
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
    // `messages` is intentionally omitted — it's only sampled at the moment a
    // name/tracked-permits change fires, never as the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, trackedPermits, selectedParkId, firstSession, makeGreeting]);

  // ── Time-aware dispatch refresh ──
  // Re-evaluates the dispatch window (a) when the user re-focuses the tab and
  // (b) automatically at the next window boundary while the tab is open.
  // Only swaps the briefing message — never touches an active conversation.
  // Crossfade is handled at render time (briefing prose container is keyed
  // off message content, with a 400ms opacity transition).
  const dispatchWindowRef = useRef<DispatchWindow | null>(null);
  useEffect(() => {
    if (firstSession) return; // first-session welcome is immutable

    const computeParkName = (): string | null => {
      if (trackedPermits.length === 0) return null;
      const sorted = [...trackedPermits].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      return PARKS[sorted[0].park_id]?.shortName || "your park";
    };

    // Seed the ref the first time so we don't needlessly swap on first focus.
    if (dispatchWindowRef.current === null) {
      dispatchWindowRef.current = getDispatchWindow(computeParkName()).key;
    }

    const evaluate = () => {
      const isBriefingState = messages.length <= 2 && messages[0]?.id === 1;
      if (!isBriefingState) return;
      const dispatch = getDispatchWindow(computeParkName());
      if (dispatchWindowRef.current === dispatch.key) return;
      dispatchWindowRef.current = dispatch.key;
      setMessages([{ id: 1, role: "assistant", content: `${dispatch.title} ${dispatch.body}` }]);
    };

    // Boundaries: 5, 9, 12, 17, 21 local. After 21 → next 5am tomorrow.
    const msToNextBoundary = (): number => {
      const now = new Date();
      const boundaries = [5, 9, 12, 17, 21];
      const cur = now.getHours();
      let nextHour = boundaries.find((h) => h > cur);
      const next = new Date(now);
      if (nextHour === undefined) {
        next.setDate(next.getDate() + 1);
        nextHour = 5;
      }
      next.setHours(nextHour, 0, 0, 50); // tiny slack so getHours() has rolled
      return Math.max(1000, next.getTime() - now.getTime());
    };

    let timer = window.setTimeout(function tick() {
      evaluate();
      timer = window.setTimeout(tick, msToNextBoundary());
    }, msToNextBoundary());

    const onVisible = () => {
      if (document.visibilityState === "visible") evaluate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", evaluate);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", evaluate);
    };
    // `messages` is intentionally omitted — we read it inside evaluate but
    // only as a gate; the trigger is the boundary timer or focus event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstSession, trackedPermits]);

  // ─── POKO PERSONALITY: idle dispatch rotation ───────────────────
  // After 3 minutes of dwelling on the Poko tab without sending a message,
  // the briefing prose subtly cycles to the next idle one-liner. Cycle is
  // non-repeating (sessionStorage-backed) and resets on send / tab switch
  // (the visibility handler clears the timer).
  // Skipped during firstSession and conversation modes.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_CYCLE_KEY = "poko_idle_cycle";
  const IDLE_INTERVAL_MS = 3 * 60 * 1000;

  const popNextIdleMessage = useCallback((): string => {
    let raw = sessionStorage.getItem(IDLE_CYCLE_KEY);
    let used: number[] = [];
    try { used = raw ? JSON.parse(raw) : []; } catch { used = []; }
    if (used.length >= IDLE_MESSAGES.length) used = [];
    const remaining = IDLE_MESSAGES.map((_, i) => i).filter((i) => !used.includes(i));
    const next = remaining[Math.floor(Math.random() * remaining.length)] ?? 0;
    used.push(next);
    sessionStorage.setItem(IDLE_CYCLE_KEY, JSON.stringify(used));
    return IDLE_MESSAGES[next];
  }, []);

  const scheduleIdleRotation = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // Re-check briefing state at fire-time; abort if the user has since
      // sent a message or a SCANNING / catch event has taken priority.
      if (isLoading) { scheduleIdleRotation(); return; }
      setMessages((prev) => {
        const isBriefing = prev.length <= 2 && prev[0]?.id === 1;
        if (!isBriefing) return prev;
        const text = popNextIdleMessage();
        return [{ id: 1, role: "assistant", content: `${PERSONALITY_MARKER}${text}` }];
      });
      scheduleIdleRotation();
    }, IDLE_INTERVAL_MS);
  }, [isLoading, popNextIdleMessage]);

  useEffect(() => {
    if (firstSession) return;
    scheduleIdleRotation();
    const onHide = () => {
      // Spec: timer resets on tab switch — clear & rearm fresh on return.
      if (document.visibilityState === "hidden" && idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      } else if (document.visibilityState === "visible") {
        scheduleIdleRotation();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [firstSession, scheduleIdleRotation]);

  // ─── POKO PERSONALITY: returning-user greeting ──────────────────
  // On Poko mount, read profile.last_seen_at. If >24h since last visit,
  // show a returning one-liner for 4s, then crossfade to the standard
  // time-aware dispatch. Always update last_seen_at to now afterward.
  const returningChecked = useRef(false);
  useEffect(() => {
    if (!user || returningChecked.current || firstSession) return;
    returningChecked.current = true;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_seen_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const last = (data as any)?.last_seen_at ? new Date((data as any).last_seen_at).getTime() : 0;
      const hoursAway = last > 0 ? (Date.now() - last) / (1000 * 60 * 60) : Infinity;
      // Stamp last_seen_at to now (fire-and-forget). Triggers no UI.
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .then(() => {});
      // First-ever visit (no prior stamp) doesn't qualify as "returning".
      if (!isFinite(hoursAway) || hoursAway < 24) return;
      setMessages((prev) => {
        const isBriefing = prev.length <= 2 && prev[0]?.id === 1;
        if (!isBriefing) return prev;
        const msg = RETURNING_MESSAGES[Math.floor(Math.random() * RETURNING_MESSAGES.length)];
        return [{ id: 1, role: "assistant", content: `${PERSONALITY_MARKER}${msg}` }];
      });
      // Crossfade to standard time-aware greeting after 4s.
      setTimeout(() => {
        if (cancelled) return;
        setMessages((prev) => {
          const isBriefing = prev.length <= 2 && prev[0]?.id === 1;
          if (!isBriefing) return prev;
          const parkName = trackedPermits.length > 0
            ? (PARKS[[...trackedPermits].sort((a, b) => {
                const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                return tb - ta;
              })[0].park_id]?.shortName || "your park")
            : null;
          const dispatch = getDispatchWindow(parkName);
          return [{ id: 1, role: "assistant", content: `${dispatch.title} ${dispatch.body}` }];
        });
      }, 4000);
    })();
    return () => { cancelled = true; };
    // trackedPermits intentionally omitted — sampled inside the closure at
    // fire-time via setMessages; trigger is mount + auth ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firstSession]);

  // ─── POKO PERSONALITY: new-alert compass moment ─────────────────
  // Polls park_alerts every 90s for the user's tracked parks. When a row
  // appears whose `last_updated` is newer than the baseline captured on
  // mount, the compass bezel does a single 15° clockwise rotation (800ms
  // out / 400ms back) and the status dot pulses once with --park-accent.
  // Polling > realtime here because park_alerts is server-managed and may
  // not be in the realtime publication; 90s is plenty for a personality
  // moment and avoids any connection cost.
  const [compassNudge, setCompassNudge] = useState(0);
  const [parkPulse, setParkPulse] = useState(0);
  const alertBaselineRef = useRef<string | null>(null);
  useEffect(() => {
    const trackedIds = Array.from(new Set(trackedPermits.map((p) => p.park_id))).filter(Boolean);
    if (trackedIds.length === 0) return;
    let cancelled = false;
    let intervalId: number | null = null;

    const check = async () => {
      const { data, error } = await supabase
        .from("park_alerts")
        .select("last_updated, park_id")
        .in("park_id", trackedIds)
        .order("last_updated", { ascending: false })
        .limit(1);
      if (cancelled || error || !data?.[0]) return;
      const latest = data[0].last_updated as string;
      if (alertBaselineRef.current === null) {
        // Seed the baseline on first read — never fires on initial mount.
        alertBaselineRef.current = latest;
        return;
      }
      if (latest > alertBaselineRef.current) {
        alertBaselineRef.current = latest;
        setCompassNudge((n) => n + 1);
        setParkPulse((n) => n + 1);
      }
    };
    check();
    intervalId = window.setInterval(check, 90_000);
    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [trackedPermits]);


  useEffect(() => {
    if (initialMountRef.current) { initialMountRef.current = false; return; }
    if (!activeScrollEl) return;
    activeScrollEl.scrollTo({ top: activeScrollEl.scrollHeight, behavior: "smooth" });
    // Sanitize warning emojis in chat bubbles
    requestAnimationFrame(() => {
      if (!activeScrollEl) return;
      const walker = document.createTreeWalker(activeScrollEl, NodeFilter.SHOW_TEXT);
      const emojiPattern = /[⚠️🔶⚡🚨🔺]/g;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (emojiPattern.test(node.textContent || '')) {
          const span = document.createElement('span');
          span.innerHTML = (node.textContent || '').replace(emojiPattern, '<span style="color:rgba(201,169,110,0.55);font-style:normal;">⚠</span>');
          node.parentNode?.replaceChild(span, node);
        }
      }
    });
  }, [messages, activeScrollEl]);

  // Auto-send when pendingSendRef is set. Trigger is the controlled `input`
  // value reaching the pending text — `isLoading` and `handleSend` are
  // intentionally read at call-time only (handleSend isn't memoized).
  useEffect(() => {
    if (pendingSendRef.current && input === pendingSendRef.current && !isLoading) {
      pendingSendRef.current = null;
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || rateLimited) return;
    haptics.light();

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
    // Personality: any send resets the 3-min idle dispatch rotation timer.
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }

    posthog.capture("mochi_message_sent");
    if (!isPro) setQuestionsUsed((prev) => prev + 1);
    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setMochiPose("scanning");
    // Cancel any pending finishing→idle timer from a prior run.
    if (finishingTimeoutRef.current) {
      clearTimeout(finishingTimeoutRef.current);
      finishingTimeoutRef.current = null;
    }
    setStreamPhase('starting');
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
              // First delta marks the transition starting → streaming.
              // Subsequent deltas throttle a "burst tick" at most every
              // 140ms so the aurora can pulse without flooding renders.
              setStreamPhase((prev) => (prev === 'streaming' ? prev : 'streaming'));
              const now = performance.now();
              if (now - lastBurstAtRef.current > 140) {
                lastBurstAtRef.current = now;
                setTokenBurstTick((n) => n + 1);
              }
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
        haptics.error();
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 2, role: "assistant", content: errorMsg },
        ]);
      }
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
      setChipsHidden(false);
      // Hold the aurora in 'finishing' for ~600ms so the wash exhales out
      // gracefully rather than snapping off the moment the stream closes.
      setStreamPhase('finishing');
      finishingTimeoutRef.current = setTimeout(() => {
        setStreamPhase('idle');
        finishingTimeoutRef.current = null;
      }, 600);
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

  /* ── Premium parallax: pointer + device-tilt drive --px / --py CSS vars
     on the Poko stage. Topo + compass + horizon glow each consume the
     vars at different magnitudes (rear layers move less, front layers
     more), creating real depth without re-rendering React. GPU-only,
     respects prefers-reduced-motion. */
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isBriefing) return;
    const el = stageRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let tx = 0, ty = 0;          // current (eased) offsets, range -1..1
    let targetX = 0, targetY = 0; // latest input target
    let raf = 0;

    const tick = () => {
      // Critically-damped ease toward target — silky, no spring overshoot.
      tx += (targetX - tx) * 0.08;
      ty += (targetY - ty) * 0.08;
      el.style.setProperty('--px', tx.toFixed(3));
      el.style.setProperty('--py', ty.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      // Map pointer to -1..1 across the stage, then dampen to ±0.5 so the
      // motion stays subtle (premium = restrained).
      targetX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width)  * 2 - 1)) * 0.5;
      targetY = Math.max(-1, Math.min(1, ((e.clientY - r.top)  / r.height) * 2 - 1)) * 0.5;
    };
    const onLeave = () => { targetX = 0; targetY = 0; };

    // Device tilt (mobile): gamma = left/right, beta = front/back.
    const onOrient = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0; // -90..90
      const b = e.beta  ?? 0; // -180..180
      targetX = Math.max(-1, Math.min(1, g / 25)) * 0.5;
      targetY = Math.max(-1, Math.min(1, (b - 30) / 25)) * 0.5;
    };

    el.addEventListener('pointermove', onPointer);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onPointer);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, [isBriefing]);


  useEffect(() => {
    if (!activeScrollEl) return;
    activeScrollEl.scrollTo({ top: activeScrollEl.scrollHeight, behavior: "smooth" });
  }, [keyboardInset, activeScrollEl]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    handleSend();
  };

  // Premium assistant status row — reflects composer state in real time.
  const [justReady, setJustReady] = useState(false);
  const lastAssistantIdRef = useRef<number | null>(null);
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!isLoading && lastMsg?.role === "assistant" && lastMsg.id !== lastAssistantIdRef.current) {
      lastAssistantIdRef.current = lastMsg.id;
      setJustReady(true);
      const t = setTimeout(() => setJustReady(false), 2400);
      return () => clearTimeout(t);
    }
  }, [isLoading, messages]);
  // (uses existing `inputFocused` state declared above)

  type PokoStatus = { key: 'scanning' | 'listening' | 'ready' | 'standing-by'; label: string; dot: string; pulse: boolean };
  const pokoStatus: PokoStatus = isLoading
    ? { key: 'scanning', label: 'Scanning…', dot: '#C9A96E', pulse: true }
    : (inputFocused || input.trim().length > 0)
      ? { key: 'listening', label: 'Listening…', dot: '#A8C4B8', pulse: true }
      : justReady
        ? { key: 'ready', label: 'Ready', dot: '#A8C4B8', pulse: false }
        : { key: 'standing-by', label: 'Standing by', dot: 'rgba(240,237,234,0.45)', pulse: false };

  const renderStatusRow = ({ tone }: { tone: 'dark' | 'light' }) => {
    const isDarkTone = tone === 'dark';
    const inkMuted = isDarkTone ? 'rgba(240,237,234,0.55)' : 'rgba(26,47,30,0.55)';
    const ruleColor = isDarkTone ? 'rgba(240,237,234,0.10)' : 'rgba(26,47,30,0.10)';
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '8px 20px 10px',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12, fontWeight: 600,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: inkMuted,
          opacity: statusOpacity,
          transform: `translateY(${(1 - statusOpacity) * -4}px)`,
          pointerEvents: statusOpacity < 0.05 ? 'none' : 'auto',
          transition: statusSnap
            ? 'color 220ms ease'
            : 'opacity 320ms cubic-bezier(0.4, 0, 0.2, 1), transform 320ms cubic-bezier(0.4, 0, 0.2, 1), color 220ms ease',
          willChange: 'opacity, transform',
        }}
      >
        <span aria-hidden="true" className={(pokoStatus.key === 'ready' || pokoStatus.key === 'standing-by') ? 'poko-ready-heartbeat' : undefined} style={{
          width: 5, height: 5, borderRadius: '50%',
          // Park-accent override on new-alert moments — single pulse, replays
          // each time `parkPulse` ticks via the `key` remount.
          background: parkPulse > 0 ? 'var(--park-accent, #C9A96E)' : pokoStatus.dot,
          boxShadow: pokoStatus.pulse ? `0 0 0 0 ${pokoStatus.dot}` : 'none',
          // Ripple pulse for active states (scanning/listening); breathing
          // heartbeat for ready/standing-by — Poko ambient-loops exception.
          animation: pokoStatus.pulse ? 'poko-status-pulse 1.6s ease-in-out infinite' : undefined,
          transition: 'background 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        // The key remount makes the park-accent flash replay on each new alert
        // (purely cosmetic — does not affect the underlying status state).
        key={`dot-${parkPulse}`}
        />
        <span>{pokoStatus.label}</span>
        <span aria-hidden="true" style={{
          flex: '0 0 28px', height: 1, marginLeft: 4,
          background: `linear-gradient(to right, ${ruleColor} 0%, transparent 100%)`,
        }} />
        <style>{`
          @keyframes poko-status-pulse {
            0%   { box-shadow: 0 0 0 0 ${pokoStatus.dot}; opacity: 1; }
            70%  { box-shadow: 0 0 0 4px rgba(168,196,184,0); opacity: 0.55; }
            100% { box-shadow: 0 0 0 0 rgba(168,196,184,0); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            [role="status"] span { animation: none !important; }
          }
        `}</style>
      </div>
    );
  };

  const renderComposer = ({
    tone,
    showDisclaimer = false,
  }: {
    tone: "dark" | "light";
    showDisclaimer?: boolean;
  }) => (
    <MochiComposer
      tone={tone}
      showDisclaimer={showDisclaimer}
      input={input}
      setInput={setInput}
      onInputKeyDown={handleInputKeyDown}
      onSend={handleSend}
      isLoading={isLoading}
      renderStatusRow={renderStatusRow}
      isPro={isPro}
      questionsUsed={questionsUsed}
      onUpgradeClick={() => setProModalOpen(true)}
    />
  );

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

  // Live park time — ticks every minute. Falls back to local time.
  const PARK_TIMEZONES: Record<string, string> = {
    yosemite: 'America/Los_Angeles',
    rainier: 'America/Los_Angeles',
    zion: 'America/Denver',
    arches: 'America/Denver',
    grand_canyon: 'America/Phoenix',
    grand_teton: 'America/Denver',
    glacier: 'America/Denver',
    rocky_mountain: 'America/Denver',
  };
  // Cartographic constants — visitor center coordinates (NPS public data).
  // Used by the compass needle to point toward the user's tracked park.
  const PARK_COORDS: Record<string, { lat: number; lng: number }> = {
    yosemite:       { lat: 37.7459, lng: -119.5936 },
    zion:           { lat: 37.2982, lng: -113.0263 },
    grand_canyon:   { lat: 36.0544, lng: -112.1401 },
    grand_teton:    { lat: 43.7904, lng: -110.6818 },
    glacier:        { lat: 48.7596, lng: -113.7870 },
    rocky_mountain: { lat: 40.3428, lng: -105.6836 },
    rainier:        { lat: 46.8523, lng: -121.7603 },
    arches:         { lat: 38.7331, lng: -109.5925 },
  };
  const [parkClock, setParkClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setParkClock(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const parkTimeLabel = (() => {
    try {
      const tz = PARK_TIMEZONES[selectedParkId ?? ''] ?? 'America/Los_Angeles';
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
      }).format(parkClock).toLowerCase().replace(' ', '\u2009');
    } catch { return ''; }
  })();
  // Park-local hour (0-23) — drives which bezel tick glows on the compass.
  const parkHour24 = (() => {
    try {
      const tz = PARK_TIMEZONES[selectedParkId ?? ''] ?? 'America/Los_Angeles';
      const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(parkClock);
      return parseInt(h, 10);
    } catch { return new Date().getHours(); }
  })();
  // Coordinate stamp for the masthead — formatted as N 37° 44' style.
  const fmtDMS = (deg: number, axis: 'lat' | 'lng') => {
    const dir = axis === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.round((abs - d) * 60);
    return `${dir} ${d}° ${m.toString().padStart(2, '0')}'`;
  };
  const parkCoords = selectedParkId ? PARK_COORDS[selectedParkId] : null;
  const coordStamp = parkCoords ? `${fmtDMS(parkCoords.lat, 'lat')}  ·  ${fmtDMS(parkCoords.lng, 'lng')}` : null;

  // Compass bearing from device location → tracked park (Move 1: living instrument).
  // Static if no geolocation: needle stays at true north (0°).
  const [needleBearing, setNeedleBearing] = useState<number>(0);
  useEffect(() => {
    if (!parkCoords || typeof navigator === 'undefined' || !navigator.geolocation) {
      setNeedleBearing(0);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const toRad = (x: number) => (x * Math.PI) / 180;
        const toDeg = (x: number) => (x * 180) / Math.PI;
        const φ1 = toRad(pos.coords.latitude);
        const φ2 = toRad(parkCoords.lat);
        const Δλ = toRad(parkCoords.lng - pos.coords.longitude);
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
        setNeedleBearing(brng);
      },
      () => setNeedleBearing(0),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 1000 * 60 * 30 }
    );
    return () => { cancelled = true; };
  }, [selectedParkId]);
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

  const [chipScrollLeft, setChipScrollLeft] = useState(0);
  const chipRowRef = useRef<HTMLDivElement | null>(null);
  const [chipOverflow, setChipOverflow] = useState({ left: false, right: false });

  const measureChipOverflow = useCallback(() => {
    const el = chipRowRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 1;
    const right = maxScroll > 1 && el.scrollLeft < maxScroll - 1;
    setChipOverflow((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, []);

  useEffect(() => {
    measureChipOverflow();
    const el = chipRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureChipOverflow());
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c as Element));
    window.addEventListener('resize', measureChipOverflow);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureChipOverflow);
    };
  }, [measureChipOverflow, chipScrollLeft]);

  const renderChipRow = (prompts: { label: string; descriptor: string; icon: typeof BarChart3 }[], fadeBg?: string) => {
    const bgColor = fadeBg || '#0B2B1B';
    const { left: fadeLeft, right: fadeRight } = chipOverflow;
    let mask: string | undefined;
    if (fadeLeft && fadeRight) {
      mask = 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)';
    } else if (fadeRight) {
      mask = 'linear-gradient(to right, black 0%, black 88%, transparent 100%)';
    } else if (fadeLeft) {
      mask = 'linear-gradient(to right, transparent 0%, black 12%, black 100%)';
    }
    return (
      <div className="relative">
        <div
          ref={chipRowRef}
          className="chip-scroll"
          onScroll={(e) => {
            setChipScrollLeft((e.target as HTMLDivElement).scrollLeft);
            measureChipOverflow();
          }}
          style={{
            display: 'flex',
            flexDirection: 'row',
            overflowX: 'scroll',
            gap: 10,
            padding: '4px 20px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}),
            transition: 'mask-image 200ms cubic-bezier(0.4, 0, 0.2, 1), -webkit-mask-image 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <style>{`.chip-scroll::-webkit-scrollbar { display: none; }`}</style>
          {prompts.map((prompt, i) => {
            const Icon = prompt.icon;
            const wasTapped = tappedChips.has(prompt.label);
            return (
              <React.Fragment key={prompt.label}>
                {i > 0 && (
                  <div style={{
                    width: 0.5, alignSelf: 'center', height: '60%',
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, transparent 100%)',
                    flexShrink: 0,
                  }} />
                )}
                <motion.button
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
                    minWidth: 100,
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 0,
                    cursor: 'pointer',
                    boxShadow: 'none',
                    transition: 'opacity 120ms ease',
                  }}
                >
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <Icon size={16} className="shrink-0" style={{ color: 'rgba(240,237,234,0.8)' }} strokeWidth={1.5} />
                    <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif", color: '#F0EDEA', whiteSpace: 'nowrap', display: 'block' }}>{prompt.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,237,234,0.55)', whiteSpace: 'nowrap', display: 'block', marginTop: 2 }}>{prompt.descriptor}</span>
                </motion.button>
              </React.Fragment>
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
      {isBriefing ? null : <MochiHeader pose={mochiPose} />}




      {isBriefing ? (
        <div
          ref={stageRef}
          className="flex-1 min-h-0 flex flex-col poko-stage"
          style={{
            position: 'relative',
            // Layered field: deep base + warm horizon + cool overhead haze.
            // Multiple offset light sources are what give premium dark UIs
            // their atmospheric depth (vs a single 2-stop gradient).
            background: [
              'radial-gradient(ellipse 70% 38% at 18% 96%, rgba(201,169,110,0.08) 0%, transparent 62%)',
              'radial-gradient(ellipse 90% 50% at 78% 4%, rgba(168,196,184,0.07) 0%, transparent 60%)',
              'radial-gradient(ellipse 60% 42% at 50% 36%, rgba(47,111,78,0.18) 0%, transparent 70%)',
              'linear-gradient(180deg, #0B2B1B 0%, #061B11 58%, #03110A 100%)',
            ].join(', '),
          }}
        >
          {/* Slow living drift — barely-perceptible parallax of the warm horizon.
              60s loop, GPU-only, respects prefers-reduced-motion. */}
          <div
            aria-hidden
            className="poko-drift"
            style={{
              position: 'absolute', inset: '-8% -6% -6% -6%', zIndex: 0,
              background:
                'radial-gradient(ellipse 55% 32% at 30% 92%, rgba(201,169,110,0.10) 0%, transparent 65%)',
              pointerEvents: 'none',
              willChange: 'transform, opacity',
            }}
          />
          {/* Aurora wash — phase-driven. Each streaming phase contributes a
              distinct color/opacity character so the field actually reads
              the assistant's lifecycle:
                starting  → cool teal at low opacity, quick rise (waiting)
                streaming → warmer mid-green, breathing pulse on token bursts
                finishing → soft champagne exhale (~600ms hold), slow fade
                idle      → fully transparent
              The pulse is keyed on `tokenBurstTick` via React's animation
              key trick — re-mounting the inner layer restarts the keyframe.
          */}
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0, zIndex: 0,
              transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: streamPhase === 'idle' ? 0 : 1,
              pointerEvents: 'none',
            }}
          >
            {/* Base wash — color/intensity reflects current phase. */}
            <div
              style={{
                position: 'absolute', inset: 0,
                background:
                  streamPhase === 'starting'
                    ? 'radial-gradient(ellipse 70% 38% at 50% 28%, rgba(168,196,184,0.07) 0%, transparent 72%)'
                    : streamPhase === 'streaming'
                      ? 'radial-gradient(ellipse 78% 44% at 50% 30%, rgba(168,196,184,0.12) 0%, rgba(47,111,78,0.06) 50%, transparent 75%)'
                      : streamPhase === 'finishing'
                        ? 'radial-gradient(ellipse 86% 50% at 50% 34%, rgba(201,169,110,0.08) 0%, transparent 75%)'
                        : 'transparent',
                transition:
                  'background 520ms cubic-bezier(0.4, 0, 0.2, 1), opacity 520ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
            {/* Token-burst pulse — re-keyed on every burst tick so the
                keyframe restarts. Pure GPU (opacity + scale). */}
            {streamPhase === 'streaming' && (
              <div
                key={tokenBurstTick}
                className="poko-aurora-burst"
                style={{
                  position: 'absolute', inset: 0,
                  background:
                    'radial-gradient(ellipse 60% 32% at 50% 32%, rgba(168,196,184,0.10) 0%, transparent 70%)',
                  willChange: 'opacity, transform',
                }}
              />
            )}
          </div>
          {/* Heavy-paper noise — 180px tile at ~3% opacity, no blend mode.
              Gives the dark surface a tactile quality. */}
          <div
            aria-hidden
            className="poko-grain"
            style={{
              position: 'absolute', inset: 0, zIndex: 2,
              pointerEvents: 'none',
              opacity: 0.03,
            }}
          />
          {/* ── Topographic chart layer (Move 3) ──
              Faint nautical-chart grid + contour curves drift slowly across the
              field. ~8% opacity, GPU-only transform. Adds the "page texture"
              that takes the screen from "designed" to "crafted." */}
          <div aria-hidden className="poko-topo" style={{
            position: 'absolute', inset: 0, zIndex: 1,
            pointerEvents: 'none',
            opacity: 0.085,
            mixBlendMode: 'screen',
            backgroundImage: [
              "linear-gradient(to right, rgba(201,169,110,0.35) 0.5px, transparent 0.5px)",
              "linear-gradient(to bottom, rgba(201,169,110,0.35) 0.5px, transparent 0.5px)",
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420'><g fill='none' stroke='%23F0EDEA' stroke-width='0.6' opacity='0.55'><path d='M-20,180 Q60,140 140,170 T300,150 T440,180'/><path d='M-20,210 Q70,170 150,200 T310,180 T440,210'/><path d='M-20,240 Q80,200 160,230 T320,210 T440,240'/><path d='M-20,270 Q90,230 170,260 T330,240 T440,270'/><path d='M-20,300 Q100,260 180,290 T340,270 T440,300'/></g></svg>\")",
            ].join(', '),
            backgroundSize: '48px 48px, 48px 48px, 420px 420px',
            backgroundPosition: '0 0, 0 0, center',
            willChange: 'transform',
          }} />
          {/* Page-fold hairline — barely-visible horizontal seam */}
          <div aria-hidden style={{
            position: 'absolute', left: 0, right: 0, top: '52%', zIndex: 1,
            height: 1,
            background: 'linear-gradient(to right, transparent 0%, rgba(201,169,110,0.12) 20%, rgba(201,169,110,0.20) 50%, rgba(201,169,110,0.12) 80%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          {/* Screen vignette — tightened for a more cinematic frame */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 3,
            background: 'radial-gradient(ellipse 85% 75% at 50% 42%, transparent 38%, rgba(0,0,0,0.42) 100%)',
            pointerEvents: 'none',
          }} />
          {/* Gilt corner brackets — leather-bound journal frame.
              Four L-shaped marks in the safe area, drawn in faint gold.
              Pure ornamentation, behind interactive content (z-index 3). */}
          {(() => {
            const bracketSize = 18;
            const bracketColor = 'rgba(201,169,110,0.32)';
            const bracketWidth = 1;
            const inset = 14;
            const cornerStyle = (corner: 'tl'|'tr'|'bl'|'br'): React.CSSProperties => {
              const isTop = corner === 'tl' || corner === 'tr';
              const isLeft = corner === 'tl' || corner === 'bl';
              return {
                position: 'absolute',
                width: bracketSize, height: bracketSize,
                [isTop ? 'top' : 'bottom']: inset,
                [isLeft ? 'left' : 'right']: inset,
                borderTop: isTop ? `${bracketWidth}px solid ${bracketColor}` : 'none',
                borderBottom: !isTop ? `${bracketWidth}px solid ${bracketColor}` : 'none',
                borderLeft: isLeft ? `${bracketWidth}px solid ${bracketColor}` : 'none',
                borderRight: !isLeft ? `${bracketWidth}px solid ${bracketColor}` : 'none',
                zIndex: 3,
                pointerEvents: 'none',
              };
            };
            return (
              <>
                <div aria-hidden style={cornerStyle('tl')} />
                <div aria-hidden style={cornerStyle('tr')} />
                <div aria-hidden style={cornerStyle('bl')} />
                <div aria-hidden style={cornerStyle('br')} />
              </>
            );
          })()}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            background: 'rgba(0,0,0,0.16)',
            opacity: inputFocused ? 1 : 0,
            transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }} />
          <style>{`
            @keyframes poko-drift {
              0%   { transform: translate3d(0,0,0)     scale(1);    opacity: 0.85; }
              50%  { transform: translate3d(2%,-1%,0)  scale(1.06); opacity: 1;    }
              100% { transform: translate3d(0,0,0)     scale(1);    opacity: 0.85; }
            }
            .poko-drift { animation: poko-drift 60s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
            .poko-grain {
              background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
              background-size: 180px 180px;
            }
            /* Compass rose decoration drift — ±0.5° / 8s ease-in-out, infinite.
               Applies to spokes + cardinals only. The needle stays semantically
               locked to the live park bearing (per cartographer-masthead memory).
               Per ambient-loops exception: Poko is the only screen with loops. */
            @keyframes poko-rose-drift {
              0%   { transform: rotate(-0.5deg); }
              50%  { transform: rotate(0.5deg); }
              100% { transform: rotate(-0.5deg); }
            }
            .poko-rose-drift { transform-origin: 66px 66px; animation: poko-rose-drift 16s ease-in-out infinite; }
            /* Personality nudge: single 15° clockwise sweep over 800ms then
               return over 400ms. Applied via key-remount so each new alert
               replays the moment. Composes with the ambient drift loop. */
            @keyframes poko-bezel-nudge {
              0%   { transform: rotate(0deg); }
              66%  { transform: rotate(15deg); }
              100% { transform: rotate(0deg); }
            }
            .poko-bezel-nudge { animation: poko-rose-drift 16s ease-in-out infinite, poko-bezel-nudge 1200ms cubic-bezier(0.4, 0, 0.2, 1) 1; }
            /* READY status heartbeat — 2s scale + opacity breath. Signals presence. */
            @keyframes poko-ready-heartbeat {
              0%, 100% { transform: scale(1);   opacity: 1;   }
              50%      { transform: scale(1.4); opacity: 0.6; }
            }
            .poko-ready-heartbeat { animation: poko-ready-heartbeat 2s ease-in-out infinite; transform-origin: center; }
            @keyframes poko-aurora-burst {
              0%   { opacity: 0;    transform: scale(0.985); }
              35%  { opacity: 1;    transform: scale(1.012); }
              100% { opacity: 0;    transform: scale(1);     }
            }
            .poko-aurora-burst { animation: poko-aurora-burst 720ms cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            @keyframes poko-topo-drift {
              0%   { transform: translate3d(0, 0, 0); }
              50%  { transform: translate3d(-12px, -8px, 0); }
              100% { transform: translate3d(0, 0, 0); }
            }
            .poko-topo { animation: poko-topo-drift 90s cubic-bezier(0.4, 0, 0.2, 1) infinite; }

            /* ── Premium parallax layer offsets ──
               --px / --py are set on .poko-stage by the parallax effect
               (range -0.5..0.5). Each layer multiplies the vars to set its
               apparent depth. Using will-change + translate3d keeps it on
               the GPU compositor. The transforms compose with each layer's
               own loop animation (drift/topo) without conflict because
               those animate child-element transforms, not the wrappers
               selected here. */
            .poko-stage {
              --px: 0; --py: 0;
            }
            .poko-stage .poko-topo {
              transform: translate3d(calc(var(--px, 0) * -10px), calc(var(--py, 0) * -8px), 0);
              transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
              will-change: transform;
            }
            .poko-stage .poko-drift {
              transform: translate3d(calc(var(--px, 0) * -4px), calc(var(--py, 0) * -3px), 0);
              transition: transform 800ms cubic-bezier(0.4, 0, 0.2, 1);
              will-change: transform;
            }
            .poko-stage .poko-emblem-reveal {
              transform: translate3d(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 10px), 0);
              transition: transform 380ms cubic-bezier(0.4, 0, 0.2, 1);
              will-change: transform;
            }
            .poko-stage .poko-vignette {
              transform: translate3d(calc(var(--px, 0) * 6px), calc(var(--py, 0) * 4px), 0);
              transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
              will-change: transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .poko-drift { animation: none; }
              .poko-aurora-burst { animation: none; opacity: 0.6; }
              .poko-topo { animation: none; }
              .poko-rose-drift { animation: none; transform: none; }
              .poko-ready-heartbeat { animation: none; }
              .poko-stage .poko-topo,
              .poko-stage .poko-drift,
              .poko-stage .poko-emblem-reveal,
              .poko-stage .poko-vignette { transform: none !important; transition: none !important; }
            }
          `}</style>
          {/* Sticky header: coordinate label */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            height: 48, flexShrink: 0,
            // Slightly taller scrim that matches the new layered base, so
            // the header dissolves into the field instead of sitting on it.
            background: 'linear-gradient(to bottom, rgba(11,43,27,0.92) 0%, rgba(11,43,27,0.55) 60%, transparent 100%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selectedParkId && PARKS[selectedParkId] ? (
              <ParkSelector
                activeParkId={selectedParkId}
                onParkChange={(id) => { haptics.medium(); setSelectedParkId(id); localStorage.setItem("wildatlas_active_park", id); }}
                variant="overlay"
              />
            ) : null}
          </div>

          {/* Scanning Ledger — persistent constraint pills.
              Sits just under the park header so users always see what
              they've told Poko to filter for. Tapping a pill opens an
              edit/remove menu — no need to retype constraints in chat. */}
          <ScanningLedger parkId={selectedParkId ?? null} />

          {/* Scrollable area */}
          <div
            ref={setScrollRef}
            data-tab-scroll
            onScroll={handleChatScroll}
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ scrollbarWidth: 'none' as const }}
          >
            {/* Bear + identity */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 28 }}>
              <style>{`
                @keyframes mochi-float {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-6px); }
                }
                .mochi-float {
                  animation: mochi-float 3s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                  .mochi-float { animation: none; }
                  .mochi-glow-pulse { animation: none; }
                  .poko-bubble-in { animation: none !important; opacity: 1 !important; }
                  .poko-listening-dot { animation: none !important; }
                  .poko-rule-draw { animation: none !important; opacity: 1 !important; transform: none !important; }
                }
                @keyframes poko-dot-bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                @keyframes poko-typing-wave {
                  0%      { transform: scale(1);   opacity: 0.4; }
                  16.66%  { transform: scale(1.4); opacity: 1;   }
                  33.33%  { transform: scale(1);   opacity: 0.4; }
                  100%    { transform: scale(1);   opacity: 0.4; }
                }
                @keyframes mochi-glow-pulse {
                  0%, 100% { opacity: 0.05; }
                  50% { opacity: 0.09; }
                }
                .mochi-glow-pulse {
                  animation: mochi-glow-pulse 4s ease-in-out infinite;
                }
                @keyframes pokoBubbleRiseLeft {
                  0%   { opacity: 0; transform: translateY(6px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes pokoBubbleRiseRight {
                  0%   { opacity: 0; transform: translateY(4px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
                .poko-bubble-in-left {
                  animation: pokoBubbleRiseLeft 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
                  transform-origin: bottom left;
                }
                .poko-bubble-in-right {
                  animation: pokoBubbleRiseRight 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
                  transform-origin: bottom right;
                }
                @keyframes poko-listen-pulse {
                  0%, 100% { opacity: 0.55; transform: scale(1); }
                  50%      { opacity: 1;    transform: scale(1.35); }
                }
                .poko-listening-dot {
                  animation: poko-listen-pulse 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                @keyframes poko-rule-draw {
                  0%   { opacity: 0; transform: scaleX(0.2); }
                  100% { opacity: 1; transform: scaleX(1); }
                }
                .poko-rule-draw {
                  animation: poko-rule-draw 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
                  transform-origin: center;
                }
              `}</style>
              {/* ── Cartographer's Field Journal masthead ──
                  Move 1: needle rotates to point at the user's tracked park
                  (real bearing from device geo → park coords); the bezel tick
                  at park-local hour glows; inner ring breathes one slow pulse
                  per scan cycle while the assistant is working.
                  Move 2: emblem + wordmark + coordinate stamp share a single
                  masthead plate (left/right), reading as one crafted object. */}
              <style>{`
                @keyframes poko-emblem-reveal {
                  0%   { opacity: 0; transform: scale(0.94); filter: blur(2px); }
                  60%  { opacity: 1; filter: blur(0); }
                  100% { opacity: 1; transform: scale(1); filter: blur(0); }
                }
                @keyframes poko-bezel-spin {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
                @keyframes poko-ink-draw {
                  0%   { stroke-dashoffset: var(--len, 400); opacity: 0; }
                  20%  { opacity: 1; }
                  100% { stroke-dashoffset: 0; opacity: 1; }
                }
                @keyframes poko-scan-breathe {
                  0%, 100% { opacity: 0.35; transform: scale(1); }
                  50%      { opacity: 0.85; transform: scale(1.04); }
                }
                @keyframes poko-sun-tick {
                  0%, 100% { opacity: 0.55; }
                  50%      { opacity: 1;    }
                }
                .poko-emblem-reveal { animation: poko-emblem-reveal 900ms cubic-bezier(0.4,0,0.2,1) both; }
                .poko-bezel-spin { animation: poko-bezel-spin 120s linear infinite; transform-origin: 50% 50%; transform-box: fill-box; }
                .poko-ink-draw { stroke-dasharray: var(--len, 400); animation: poko-ink-draw 1400ms cubic-bezier(0.4,0,0.2,1) 200ms both; }
                .poko-scan-breathe { animation: poko-scan-breathe 2.4s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: 50% 50%; transform-box: fill-box; }
                .poko-sun-tick { animation: poko-sun-tick 3.5s cubic-bezier(0.4,0,0.2,1) infinite; }
                .poko-needle-living {
                  transition: transform 1800ms cubic-bezier(0.34, 1.18, 0.4, 1);
                  transform-origin: 66px 66px;
                }
                @media (prefers-reduced-motion: reduce) {
                  .poko-emblem-reveal, .poko-bezel-spin, .poko-ink-draw, .poko-scan-breathe, .poko-sun-tick { animation: none !important; opacity: 1 !important; }
                  .poko-needle-living { transition: none !important; }
                }
              `}</style>

              {/* Masthead plate — emblem (left) + wordmark stack (right).
                  Shares a baseline so the composition reads as one object. */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 18, padding: '16px 20px 0',
                width: '100%', maxWidth: 360,
              }}>
                {/* Emblem */}
                <div className="poko-emblem-reveal" style={{
                  position: 'relative', width: 96, height: 96, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Static 200px amber wash — barely-visible warmth centered
                      on the compass. Per spec: rgba(201,169,110,0.06). Static. */}
                  <div aria-hidden="true" style={{
                    position: 'absolute',
                    width: 200, height: 200,
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'radial-gradient(circle at center, rgba(201,169,110,0.06) 0%, rgba(201,169,110,0.03) 45%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }} />
                  {/* Soft gold parchment glow (existing layered warmth) */}
                  <div className="mochi-glow-pulse" aria-hidden="true" style={{
                    position: 'absolute', inset: -16,
                    background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.16) 0%, rgba(201,169,110,0.04) 50%, transparent 75%)',
                    pointerEvents: 'none',
                  }} />
                  {/* Radar sweep arm — Prompt 5. Only spins while Poko is
                      working. Compass rose itself stays static; arm rotates
                      1.5s/360° with a 120° trailing fade (conic-gradient).
                      Sits above the SVG (z-index) so the leading edge reads. */}
                  {isLoading && (
                    <div aria-hidden="true" className="wa-radar-arm" style={{ zIndex: 2 }} />
                  )}
                  <svg
                    viewBox="0 0 132 132"
                    width="96" height="96"
                    aria-label={parkCoords ? `Compass — pointing toward ${PARKS[selectedParkId!]?.shortName ?? 'tracked park'}` : 'Poko field emblem'}
                    style={{ position: 'relative', display: 'block', overflow: 'visible' }}
                  >
                    <defs>
                      <radialGradient id="poko-seal-fill" cx="50%" cy="42%" r="60%">
                        <stop offset="0%" stopColor="rgba(240,237,234,0.06)" />
                        <stop offset="70%" stopColor="rgba(240,237,234,0.02)" />
                        <stop offset="100%" stopColor="rgba(240,237,234,0)" />
                      </radialGradient>
                      <linearGradient id="poko-needle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor="#C9A96E" />
                        <stop offset="50%" stopColor="#C9A96E" />
                        <stop offset="50.01%" stopColor="#F0EDEA" />
                        <stop offset="100%" stopColor="#F0EDEA" />
                      </linearGradient>
                    </defs>

                    {/* Inner parchment seal */}
                    <circle cx="66" cy="66" r="54" fill="url(#poko-seal-fill)" />

                    {/* Scanner-pulse breathing ring — only when assistant is working */}
                    {isLoading && (
                      <circle
                        className="poko-scan-breathe"
                        cx="66" cy="66" r="60"
                        fill="none" stroke="rgba(201,169,110,0.55)" strokeWidth="0.6"
                      />
                    )}

                    {/* Outer hairline ring */}
                    <circle
                      className="poko-ink-draw"
                      style={{ ['--len' as any]: 360 } as React.CSSProperties}
                      cx="66" cy="66" r="58"
                      fill="none" stroke="rgba(240,237,234,0.32)" strokeWidth="0.75"
                    />
                    {/* Gold inner ring */}
                    <circle
                      className="poko-ink-draw"
                      style={{ ['--len' as any]: 320 } as React.CSSProperties}
                      cx="66" cy="66" r="51"
                      fill="none" stroke="rgba(201,169,110,0.55)" strokeWidth="0.5"
                    />

                    {/* Bezel — 24-hour ticks. The tick at park-local hour
                        glows gold (sundial dimension). Each hour = 15°. */}
                    <g>
                      {Array.from({ length: 24 }).map((_, i) => {
                        const isMajor = i % 6 === 0;
                        const isNow = i === parkHour24;
                        const len = isNow ? 7 : isMajor ? 5 : 2.5;
                        const stroke = isNow ? '#C9A96E' : '#F0EDEA';
                        const opacity = isNow ? 1 : isMajor ? 0.55 : 0.28;
                        const width = isNow ? 1.2 : isMajor ? 0.8 : 0.5;
                        return (
                          <line
                            key={i}
                            className={isNow ? 'poko-sun-tick' : undefined}
                            x1="66" y1={66 - 58}
                            x2="66" y2={66 - 58 + len}
                            stroke={stroke}
                            strokeOpacity={opacity}
                            strokeWidth={width}
                            transform={`rotate(${i * 15} 66 66)`}
                          />
                        );
                      })}
                    </g>

                    {/* Rose decoration — cardinal letters + diagonal spokes.
                        Drifts ±0.5° / 16s (8s each way) ease-in-out infinite.
                        Per ambient-loops exception: Poko-only loop. The needle
                        below stays semantically locked to the live bearing. */}
                    <g
                      key={`bezel-${compassNudge}`}
                      className={`poko-rose-drift${compassNudge > 0 ? ' poko-bezel-nudge' : ''}`}
                    >
                      {/* Cardinal letters — N E S W */}
                      {[
                        { l: 'N', x: 66, y: 18 },
                        { l: 'E', x: 116, y: 70 },
                        { l: 'S', x: 66, y: 120 },
                        { l: 'W', x: 16, y: 70 },
                      ].map((c) => (
                        <text
                          key={c.l}
                          x={c.x} y={c.y}
                          textAnchor="middle"
                          fontFamily="'Cormorant Garamond', serif"
                          fontSize="9"
                          fontStyle="italic"
                          fill="rgba(201,169,110,0.85)"
                          letterSpacing="0.12em"
                        >{c.l}</text>
                      ))}
                      {/* Diagonal spokes — static, faint guides (drift with rose) */}
                      {[45, 135, 225, 315].map((deg) => (
                        <polygon
                          key={deg}
                          points="66,40 68.5,66 66,92 63.5,66"
                          fill="rgba(240,237,234,0.08)"
                          stroke="rgba(240,237,234,0.18)"
                          strokeWidth="0.4"
                          transform={`rotate(${deg} 66 66)`}
                        />
                      ))}
                    </g>

                    {/* Compass needle — rotates toward tracked park (live bearing).
                        Stays outside the rose drift so its angle remains truthful. */}
                    <g
                      className="poko-needle-living"
                      style={{ transform: `rotate(${needleBearing}deg)` }}
                    >
                      {/* Main pointing needle (gold half = "toward park") */}
                      <polygon
                        points="66,22 70,66 66,110 62,66"
                        fill="url(#poko-needle)"
                        stroke="rgba(0,0,0,0.25)"
                        strokeWidth="0.4"
                      />
                      {/* Hub */}
                      <circle cx="66" cy="66" r="3.2" fill="#0B2B1B" stroke="#C9A96E" strokeWidth="0.6" />
                      <circle cx="66" cy="66" r="1" fill="#C9A96E" />
                    </g>
                  </svg>
                </div>

                {/* Wordmark stack — shares baseline with emblem */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  {/* POKO wordmark — letterpress: deboss above (highlight) +
                      below (shadow) creates the impression of ink pressed
                      into heavy paper. The two textShadows must stay paired. */}
                  <p style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 38, fontWeight: 400,
                    letterSpacing: '0.3em',
                    color: '#F0EDEA',
                    margin: 0, lineHeight: 1,
                    textIndent: '0.3em',
                    textShadow: '0 1px 0 rgba(255,255,255,0.06), 0 -1px 0 rgba(0,0,0,0.45), 0 0 18px rgba(201,169,110,0.10)',
                  }}>POKO</p>
                  {/* Hairline + diamond rule (drawn-in) — accent shifts with active park */}
                  <div className="poko-rule-draw poko-park-rule" aria-hidden="true" style={{
                    marginTop: 8,
                    display: 'flex', alignItems: 'center', gap: 7,
                    width: '100%', minWidth: 110,
                  }}>
                    <span style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(var(--park-accent-rgb), 0.55), rgba(var(--park-accent-rgb), 0.20))', transition: 'background 300ms ease-out' }} />
                    <span style={{
                      width: 4, height: 4, transform: 'rotate(45deg)',
                      background: 'rgba(var(--park-accent-rgb), 0.85)',
                      boxShadow: '0 0 4px rgba(var(--park-accent-rgb), 0.45)',
                      transition: 'background 300ms ease-out, box-shadow 300ms ease-out',
                    }} />
                    <span style={{ flex: 1, height: 1, background: 'linear-gradient(to left, rgba(var(--park-accent-rgb), 0.55), rgba(var(--park-accent-rgb), 0.20))', transition: 'background 300ms ease-out' }} />
                  </div>
                  {/* Coordinate stamp — uses --park-accent on the dark Poko surface (full opacity) */}
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10, fontWeight: 500,
                    letterSpacing: '0.28em', textTransform: 'uppercase',
                    color: 'var(--park-accent)',
                    margin: '8px 0 0',
                    fontFeatureSettings: '"tnum" 1',
                    whiteSpace: 'nowrap',
                    transition: 'color 300ms ease-out',
                  }}>
                    {coordStamp ?? 'Field Journal · Est. MMXXIV'}
                  </p>
                </div>
              </div>

              {/* Live meta-line: status · park time */}
              <div style={{
                marginTop: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12, fontWeight: 500,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(240,237,234,0.55)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="poko-listening-dot" style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: pokoStatus.dot, display: 'inline-block',
                    boxShadow: `0 0 6px ${pokoStatus.dot}`,
                  }} />
                  {pokoStatus.label}
                </span>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(240,237,234,0.28)' }} />
                <span style={{ fontFeatureSettings: '"tnum" 1', letterSpacing: '0.14em' }}>{parkTimeLabel} · park time</span>
              </div>

              {/* Imprimatur — small intaglio press seal that quietly certifies
                  the dispatch. Italic Cormorant inside a hairline ring with a
                  diamond glyph. Pure decoration. */}
              <div aria-hidden="true" style={{
                marginTop: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: 0.55,
              }}>
                <span style={{ flex: '0 0 28px', height: 1, background: 'linear-gradient(to right, transparent, rgba(201,169,110,0.45))' }} />
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px',
                  border: '1px solid rgba(201,169,110,0.32)',
                  borderRadius: 999,
                }}>
                  <span style={{
                    width: 4, height: 4, transform: 'rotate(45deg)',
                    background: 'rgba(201,169,110,0.9)',
                    boxShadow: '0 0 4px rgba(201,169,110,0.5)',
                  }} />
                  <span style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontStyle: 'italic',
                    fontSize: 10,
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    color: 'rgba(201,169,110,0.78)',
                    fontFeatureSettings: '"tnum" 1',
                  }}>Imprimatur · MMXXVI</span>
                </span>
                <span style={{ flex: '0 0 28px', height: 1, background: 'linear-gradient(to left, transparent, rgba(201,169,110,0.45))' }} />
              </div>
            </div>

            {/* Briefing bubble — minWidth:0 prevents the chip row's
                intrinsic width from pushing this column past the viewport,
                which previously clipped the DISPATCH "today" label and
                truncated the FOLLOW UP / ASK ABOUT hairline rules. */}
            <div style={{ margin: '28px 0 0', padding: '0 24px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 0, minWidth: 0 }} aria-live="polite" aria-atomic="false" aria-relevant="additions">
                {(() => {
                  // Compute the burst window once per render: any message at
                  // index ≥ burstStart is "newly arrived" and gets a stagger.
                  const grew = messages.length > prevMsgCountRef.current;
                  if (grew) burstStartRef.current = prevMsgCountRef.current;
                  prevMsgCountRef.current = messages.length;
                  return null;
                })()}
                <MochiMessageList
                  tone="briefing"
                  messages={messages}
                  burstStart={burstStartRef.current}
                  selectedParkId={selectedParkId ?? null}
                  firstSession={!!firstSession}
                  onUpgradeClick={() => setProModalOpen(true)}
                />

                <AnimatePresence>
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex justify-start poko-bubble-in-left"
                      style={{ marginTop: 12 }}
                    >
                      <div style={typingBubbleStyle}>
                        <span style={typingDotStyle(0)} />
                        <span style={typingDotStyle(1)} />
                        <span style={typingDotStyle(2)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Sticky footer: chips + input */}
          <div style={{ flexShrink: 0, background: 'transparent', position: 'relative', zIndex: 6 }}>
              {/* Editorial section divider — hairline + eyebrow */}
              {!chipsHidden && !isLoading && messages[messages.length - 1]?.role === "assistant" && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '0 24px', marginTop: 14, marginBottom: 6,
                  minWidth: 0, maxWidth: '100%', overflow: 'hidden',
                }}>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12, fontWeight: 600,
                    letterSpacing: '0.24em', textTransform: 'uppercase',
                    color: 'rgba(240,237,234,0.42)',
                    whiteSpace: 'nowrap',
                  }}>
                    {messages.some((m) => m.role === "user") ? 'Follow up' : 'Ask about'}
                  </span>
                  <span style={{
                    flex: 1, height: 1,
                    background: 'linear-gradient(to right, rgba(240,237,234,0.18) 0%, transparent 100%)',
                  }} />
                </div>
              )}
              {!chipsHidden && !isLoading && messages[messages.length - 1]?.role === "assistant" && (() => {
                const hasUserMessage = messages.some((m) => m.role === "user");
                if (hasUserMessage) {
                  const lastReply = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
                  const watches: UserWatch[] = trackedPermits.map((p) => ({ park_id: p.park_id, permit_name: p.permit_name }));
                  const chips = getSuggestedChips(lastReply, watches, quickParkName === "the parks" ? null : quickParkName);
                  if (chips.length > 0) {
                    return (
                      <div style={{ flexShrink: 0, marginTop: 12 }}>
                        {renderChipRow(chips)}
                      </div>
                    );
                  }
                  return null;
                }
                if (trackedPermits.length > 0) {
                  const greetingText = messages[0]?.content ?? "";
                  const watches: UserWatch[] = trackedPermits.map((p) => ({ park_id: p.park_id, permit_name: p.permit_name }));
                  const contextChips = getSuggestedChips(greetingText, watches, quickParkName === "the parks" ? null : quickParkName);
                  if (contextChips.length > 0) {
                    return (
                      <div style={{ flexShrink: 0, marginTop: 12 }}>
                        {renderChipRow(contextChips)}
                      </div>
                    );
                  }
                }
                return (
                  <div
                    role="group"
                    aria-label="Suggested prompts"
                    style={{ position: 'relative', marginLeft: 24, marginRight: 24, marginTop: 4 }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        // hairline separators rendered via background lines on the grid
                        position: 'relative',
                      }}
                    >
                      {/* Vertical hairline between columns */}
                      <span aria-hidden="true" style={{
                        position: 'absolute', top: '14%', bottom: '14%', left: '50%',
                        width: 1, transform: 'translateX(-0.5px)',
                        background: 'linear-gradient(to bottom, transparent 0%, rgba(240,237,234,0.16) 50%, transparent 100%)',
                        pointerEvents: 'none',
                      }} />
                      {BRIEFING_CHIP_SETS[briefingChipSetIdx].map((label, i) => {
                        const isTopRow = i < 2;
                        return (
                          <span
                            key={label}
                            role="button"
                            tabIndex={0}
                            aria-label={label}
                            className={`mochi-briefing-chip ${usedBriefingChips.has(label) ? 'mochi-chip-out' : ''}`}
                            onClick={() => handleBriefingChipTap(label)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBriefingChipTap(label); } }}
                            style={{
                              fontSize: 12.5, fontWeight: 400, fontFamily: "'DM Sans', sans-serif",
                              color: '#F0EDEA', background: 'transparent',
                              border: 'none',
                              // Tighter right padding + minWidth:0 so longer
                              // park-prefixed labels (e.g. "Yosemite crowds")
                              // never get clipped at 390px viewports.
                              padding: '12px 12px 12px 14px',
                              minWidth: 0,
                              overflowWrap: 'normal',
                              wordBreak: 'normal',
                              hyphens: 'none',
                              borderTop: !isTopRow
                                ? '1px solid transparent'
                                : 'none',
                              borderImage: !isTopRow
                                ? 'linear-gradient(to right, transparent 0%, rgba(240,237,234,0.16) 50%, transparent 100%) 1'
                                : undefined,
                              borderRadius: 0, cursor: 'pointer',
                              boxShadow: 'none',
                              letterSpacing: '0.01em', lineHeight: 1.4,
                              textAlign: 'left',
                              transition: 'color 0.15s, opacity 0.15s',
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginTop: 14, padding: `0 20px ${composerBottomPadding}`, transition: 'padding-bottom 0.22s ease-out' }}>
                {/* Composer hairline rule */}
                <div aria-hidden="true" style={{
                  height: 1, marginBottom: 4,
                  background: `linear-gradient(to right, transparent 0%, rgba(240,237,234,${inputFocused ? 0.34 : 0.16}) 50%, transparent 100%)`,
                  transition: 'background 220ms ease',
                }} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="Tell Poko what you're looking for..."
                    aria-label="Ask Poko"
                    className="poko-bare-input"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: 17,
                      fontStyle: 'italic',
                      fontWeight: 400,
                      color: 'rgba(240,237,234,0.92)',
                      outline: 'none',
                      padding: '6px 0',
                      minWidth: 0,
                    }}
                    disabled={isLoading}
                  />
                  <style>{`
                    .poko-bare-input::placeholder { color: rgba(240,237,234,0.38) !important; font-style: italic !important; }
                    @keyframes caretSine {
                      0%   { caret-color: rgba(245,245,240,0.20); }
                      25%  { caret-color: rgba(245,245,240,0.65); }
                      50%  { caret-color: rgba(245,245,240,0.90); }
                      75%  { caret-color: rgba(245,245,240,0.65); }
                      100% { caret-color: rgba(245,245,240,0.20); }
                    }
                    .poko-bare-input { animation: caretSine 1.5s ease-in-out infinite; caret-color: rgba(245,245,240,0.90); caret-width: 1px; }
                  `}</style>
                  <style>{`
                    .poko-send-pill { transition: background 220ms ease, border-color 220ms ease, transform 120ms ease; }
                    .poko-send-pill:not(:disabled):hover { background: #C9A96E; border-color: #C9A96E; }
                    .poko-send-pill:not(:disabled):active { transform: scale(0.94); }
                  `}</style>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    aria-label={isLoading ? "Sending message" : "Send message"}
                    aria-busy={isLoading}
                    aria-disabled={isLoading || !input.trim()}
                    className="poko-send-pill"
                    style={{
                      width: 36, height: 36,
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: !input.trim() || isLoading ? 'rgba(240,237,234,0.04)' : 'rgba(201,169,110,0.92)',
                      border: `1px solid rgba(240,237,234,${!input.trim() || isLoading ? 0.18 : 0.0})`,
                      cursor: (!input.trim() || isLoading) ? 'default' : 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      opacity: 1,
                    }}
                  >
                    {isLoading ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" style={{ color: 'rgba(240,237,234,0.6)' }} />
                    ) : (
                      <ArrowUp size={16} strokeWidth={2} aria-hidden="true" style={{ color: !input.trim() ? 'rgba(240,237,234,0.45)' : '#1A2F1E' }} />
                    )}
                  </button>
                </div>
                <div style={{ paddingBottom: 12 }}>
                  {renderStatusRow({ tone: 'dark' })}
                  <p style={{ fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", color: 'rgba(240,237,234,0.40)', textAlign: 'center', padding: '0 20px', margin: '8px 0 0', lineHeight: 1.5, letterSpacing: '0.01em' }}>
                    Poko can make mistakes. Verify permits and trail conditions at nps.gov and recreation.gov.
                  </p>
                  {!isPro && (() => {
                    const remaining = 5 - questionsUsed;
                    if (remaining > 3 || remaining < 0) return null;
                    return (
                      <p style={{ fontSize: 12, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', textAlign: 'center', margin: '4px 0 8px', lineHeight: 1.4 }}>
                        {remaining > 0 ? (
                          <span style={{ color: 'rgba(240,237,234,0.38)' }}>{remaining} question{remaining !== 1 ? 's' : ''} remaining today</span>
                        ) : (
                          <span
                            style={{ color: '#A8C4B8', cursor: 'pointer' }}
                            onClick={() => { haptics.medium(); setProModalOpen(true); }}
                            role="button"
                            tabIndex={0}
                          >
                            Upgrade to Pro for unlimited questions
                          </span>
                        )}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={setScrollRef} onScroll={handleChatScroll} className="flex-1 min-h-0 overflow-y-auto" data-tab-scroll style={{ position: 'relative' }}>
            <div style={{ padding: '16px 16px 0' }} aria-live="polite" aria-atomic="false" aria-relevant="additions">
              <MochiMessageList
                tone="conversation"
                messages={messages}
                burstStart={0}
                selectedParkId={selectedParkId ?? null}
                firstSession={!!firstSession}
                onUpgradeClick={() => setProModalOpen(true)}
              />

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
              if (chips.length === 0) return null;
              const eyebrowLabel = messages.some((m) => m.role === "user") ? 'Follow up' : 'Ask about';
              return (
                <div style={{ flexShrink: 0, padding: '0 0 12px' }} role="group" aria-label={`${eyebrowLabel} — suggested prompts`}>
                  {/* Editorial section divider — eyebrow + hairline */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0 20px', marginTop: 10, marginBottom: 6,
                  }}>
                    <span style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12, fontWeight: 600,
                      letterSpacing: '0.24em', textTransform: 'uppercase',
                      color: 'rgba(240,237,234,0.42)',
                      whiteSpace: 'nowrap',
                    }}>
                      {eyebrowLabel}
                    </span>
                    <span aria-hidden="true" style={{
                      flex: 1, height: 1,
                      background: 'linear-gradient(to right, rgba(240,237,234,0.18) 0%, transparent 100%)',
                    }} />
                  </div>
                  <div style={{ padding: '0 16px' }}>{renderChipRow(chips)}</div>
                </div>
              );
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

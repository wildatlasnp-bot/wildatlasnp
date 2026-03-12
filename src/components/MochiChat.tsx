import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import posthog from "@/lib/posthog";

// Mochi pose assets (public directory)
const MOCHI_SMILING = "/assets/mochi/chat/mochi-smiling.png";
const MOCHI_SCANNING = "/assets/mochi/poses/mochi-scanning.png";
const MOCHI_CELEBRATING = "/assets/mochi/poses/mochi-celebrating.png";

type MochiPose = "idle" | "scanning" | "celebrating";

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
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mochi-chat`;
const SESSION_KEY = "mochi_introduced";
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

const MochiChat = ({ onNavigateToDiscover }: { onNavigateToDiscover?: (parkId: string) => void }) => {
  const { displayName, user } = useAuth();
  const [trackedPermits, setTrackedPermits] = useState<TrackedPermitInfo[]>([]);

  // Fetch user's tracked permits for dynamic greeting
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_watchers")
      .select("scan_targets(park_id, permit_type)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          setTrackedPermits(data.map((d: any) => ({
            permit_name: d.scan_targets?.permit_type ?? "",
            park_id: d.scan_targets?.park_id ?? "",
          })));
        }
      });
  }, [user]);

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

      const content = [
        `${timeLabel}${firstName ? `, ${firstName}` : ""} 👋`,
        `Exploring ${fs.parkName} ${timeCasual}?`,
        "",
        `I'm scanning for ${fs.permitName} permits every 2 minutes.`,
        "",
        alertLine,
        "",
        "I can also help with trail conditions, crowd levels, or planning your visit.",
      ].join("\n");

      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content };
    }

    // ── Standard greeting — contextual + time-aware ──
    const greeting = `${timeLabel}${firstName ? `, ${firstName}` : ""} 👋`;
    const parkLine = `Exploring ${parkName} ${timeCasual}?`;

    // Build contextual body based on all tracked permits
    const primaryParkPermits = trackedPermits.filter((p) => p.park_id === primaryParkId);
    let body: string;

    if (primaryParkPermits.length > 0) {
      const permitNames = primaryParkPermits.map((p) => p.permit_name).join(" and ");
      body = [
        `I'm scanning for ${permitNames} every 2 minutes.`,
        "",
        "If one becomes available, I'll alert you immediately.",
        "",
        "I can also help with trail conditions, crowd levels, or planning your visit.",
      ].join("\n");
    } else if (trackedPermits.length > 0) {
      body = [
        `I'm monitoring ${trackedPermits.length} permit${trackedPermits.length > 1 ? "s" : ""} for you right now.`,
        "",
        "I can help with trail conditions, crowd levels, or permits at any park.",
      ].join("\n");
    } else {
      // Empty state
      body = [
        "I can monitor permits for you or help plan your visit.",
        "",
        "Ask me about trails, crowd levels, or permits across the parks.",
      ].join("\n");
    }

    let tripLine = "";
    const savedArrival = localStorage.getItem("wildatlas_arrival_date");
    if (savedArrival) {
      const now = new Date();
      const arrivalDate = new Date(savedArrival);
      const diffMs = arrivalDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const tripParkId = localStorage.getItem("wildatlas_active_park") || primaryParkId;
      const tripParkName = PARKS[tripParkId]?.shortName || "your park";

      if (daysUntil === 1) {
        tripLine = `\n\nTomorrow's the day — here's your ${tripParkName} morning briefing.`;
      } else if (daysUntil > 1 && daysUntil <= 7) {
        tripLine = `\n\nYour ${tripParkName} trip is in ${daysUntil} days — let's make sure you're ready.`;
      } else if (daysUntil > 7) {
        tripLine = `\n\n${daysUntil} days until ${tripParkName} — here's what to know this week.`;
      }
    }

    const content = `${greeting}\n${parkLine}\n\n${body}${tripLine}`;
    sessionStorage.setItem(SESSION_KEY, "true");
    return { id: 1, role: "assistant", content };
  };

  const [messages, setMessages] = useState<Message[]>(() => [makeGreeting()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [mochiPose, setMochiPose] = useState<MochiPose>("idle");
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
        { id: now, role: "assistant", content: "Whoa, slow down! 🐻 Let me catch my breath. Try again in a minute." },
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
    const timeout = setTimeout(() => controller.abort(), 30_000);

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
        if (resp.status === 429) throw new Error("rate_limit");
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
      let errorMsg: string;
      if (e.name === "AbortError") {
        errorMsg = "Something went wrong. Try asking again.";
      } else if (e.message === "rate_limit") {
        errorMsg = "Too many questions at once 🐻 Give it a minute and try again.";
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

  // Park-aware quick prompts based on tracked permits
  const quickParkName = PARKS[primaryParkId]?.shortName || "the parks";
  const primaryParkPermits = trackedPermits.filter((p) => p.park_id === primaryParkId);
  const primaryPermit = firstSession?.permitName || primaryParkPermits[0]?.permit_name || trackedPermits[0]?.permit_name;

  const quickPrompts = primaryPermit
    ? [
        `Best time to enter ${quickParkName}`,
        "Crowd levels this weekend",
        `Permits for ${primaryPermit}`,
      ]
    : [
        `Best time to enter ${quickParkName}`,
        "Crowd levels this weekend",
        `What permits does ${quickParkName} need?`,
      ];

  // Get unique tracked parks (id + name) for the monitoring indicator
  const trackedParksUnique = [...new Map(
    trackedPermits.map((p) => [p.park_id, { id: p.park_id, name: PARKS[p.park_id]?.shortName }])
  ).values()].filter((p) => p.name);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        {!isBriefing && (
          <motion.img
            key={mochiPose}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            src={mochiPose === "scanning" ? MOCHI_SCANNING : mochiPose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_SMILING}
            alt="Mochi"
            className="w-10 h-10 rounded-full object-contain bg-muted/40 border border-border/40 p-0.5"
          />
        )}
        <div>
          <p className="text-xs font-medium text-secondary tracking-widest uppercase">Park Guide</p>
          {!isBriefing && <p className="text-[11px] text-muted-foreground/60 font-medium">Mochi</p>}
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-2" data-tab-scroll>
        {/* ── Briefing view ── */}
        {isBriefing && (
          <div className="px-5 flex flex-col justify-center" style={{ minHeight: "calc(100% - 16px)" }}>
            {/* Mochi hero illustration */}
            <div className="text-center mb-5 mt-4">
              <div className="mx-auto mb-1" style={{ width: "min(140px, 30vw)" }}>
                <img
                  src={mochiPose === "scanning" ? MOCHI_SCANNING : mochiPose === "celebrating" ? MOCHI_CELEBRATING : MOCHI_SMILING}
                  alt="Mochi"
                  className="w-full h-auto object-contain drop-shadow-md"
                />
              </div>
              <h1 className="text-[22px] font-heading font-bold text-foreground leading-tight">Mochi</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-1.5 font-medium">Your national parks guide</p>
            </div>

            {/* Initial greeting card — conversational chat bubble */}
            <AnimatePresence mode="wait">
              <motion.div
                key={messages[0]?.content}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-muted/40 border border-border/50 rounded-2xl px-5 py-5 mb-6"
                style={{ boxShadow: "var(--card-shadow)" }}
              >
                <div className="space-y-3">
                  {messages[0].content.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    // First line (greeting) gets slightly larger text
                    if (i === 0) {
                      return (
                        <p key={i} className="text-[14px] font-body font-medium text-foreground leading-snug">
                          {trimmed}
                        </p>
                      );
                    }
                    return (
                      <p key={i} className="text-[13px] font-body text-foreground/80 leading-relaxed">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  onClick={() => setInput(prompt)}
                  className="text-[11px] font-semibold text-secondary bg-secondary/8 hover:bg-secondary/20 active:scale-[0.96] border-[1.5px] border-secondary/25 hover:border-secondary/40 rounded-full px-4 py-2 transition-all duration-150 max-w-full break-words"
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
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
                      <img src={MOCHI_SMILING} alt="Mochi" className="w-4 h-4 rounded-full opacity-80" />
                      <span className="text-[9px] font-bold text-secondary/60 uppercase tracking-wider">Mochi</span>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="mochi-prose">
                      <ReactMarkdown>{formatInlineBullets(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}

            {/* Suggestion chips after last assistant message */}
            {!isLoading && messages[messages.length - 1]?.role === "assistant" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-wrap gap-2 pt-1"
              >
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setInput(chip)}
                    className="text-[11px] font-medium text-foreground/70 bg-[#F3F4F6] dark:bg-muted/60 rounded-full px-3.5 py-2 hover:bg-[#E5E7EB] dark:hover:bg-muted active:scale-[0.96] transition-all duration-150"
                  >
                    {chip}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
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

      {/* Sticky chat input */}
      <div className="sticky bottom-0 bg-background border-t border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 bg-card border border-border/70 rounded-[18px] px-4 py-2.5" style={{ boxShadow: "0 -2px 12px -4px hsl(var(--foreground) / 0.04)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Mochi about parks or permits…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none min-w-0"
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
      </div>
    </div>
  );
};

export default MochiChat;

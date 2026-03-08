import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import posthog from "@/lib/posthog";

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

const maskPhone = (phone: string): string => {
  if (!phone) return "your phone";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(***) ***-****";
  return `(***) ***-${digits.slice(-4)}`;
};

const MochiChat = ({ parkId = "yosemite" }: { parkId?: string; onParkChange?: (id: string) => void }) => {
  const { displayName, user } = useAuth();
  const [trackedPermits, setTrackedPermits] = useState<TrackedPermitInfo[]>([]);

  // Fetch user's tracked permits for dynamic greeting
  useEffect(() => {
    if (!user) return;
    supabase
      .from("active_watches")
      .select("permit_name, park_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setTrackedPermits(data);
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

  const makeGreeting = (): Message => {
    const now = new Date();
    const hour = now.getHours();
    const firstName = displayName?.trim().split(/\s+/)[0] || "";

    // ── First-session welcome (one-time after onboarding) ──
    if (firstSession && firstSession.permitName) {
      const fs = firstSession;
      const phoneMasked = fs.phone ? maskPhone(fs.phone) : null;
      const alertLine = phoneMasked
        ? `If one becomes available, I'll text you at ${phoneMasked}.`
        : "If one becomes available, I'll alert you immediately.";

      const content = [
        firstName ? `Hello ${firstName} 👋` : "Hello 👋",
        "",
        `I'm scanning for ${fs.permitName} permits at ${fs.parkName} every 2 minutes.`,
        "",
        alertLine,
        "",
        "While you wait, I can also help with planning your visit.",
      ].join("\n");

      sessionStorage.setItem(SESSION_KEY, "true");
      return { id: 1, role: "assistant", content };
    }

    // ── Standard greeting with tracked permits context ──
    let greeting: string;
    if (hour >= 5 && hour < 12) {
      greeting = firstName ? `Good morning, ${firstName} 👋` : "Good morning 👋";
    } else if (hour >= 12 && hour < 17) {
      greeting = firstName ? `Good afternoon, ${firstName} 👋` : "Good afternoon 👋";
    } else if (hour >= 17 && hour < 21) {
      greeting = firstName ? `Good evening, ${firstName} 👋` : "Good evening 👋";
    } else {
      greeting = firstName ? `Hey ${firstName} 👋` : "Hey there 👋";
    }

    // Build contextual body based on tracked permits
    const currentParkPermits = trackedPermits.filter((p) => p.park_id === parkId);
    const parkName = PARKS[parkId]?.shortName || "your park";
    let body: string;

    if (currentParkPermits.length > 0) {
      const permitNames = currentParkPermits.map((p) => p.permit_name).join(" and ");
      body = [
        `I'm scanning for ${permitNames} at ${parkName} every 2 minutes.`,
        "",
        "If one becomes available, I'll alert you immediately.",
        "",
        "While you wait, I can also help with planning your visit.",
      ].join("\n");
    } else if (trackedPermits.length > 0) {
      body = [
        `I'm monitoring ${trackedPermits.length} permit${trackedPermits.length > 1 ? "s" : ""} for you right now.`,
        "",
        "I can help with trail conditions, packing lists, or crowd forecasts for any park.",
      ].join("\n");
    } else {
      // Empty state — no permits tracked
      body = "I can monitor permits for you or help plan your visit.\n\nAsk me about trails, crowds, or permits at any of our 6 national parks.";
    }

    let tripLine = "";
    const savedArrival = localStorage.getItem("wildatlas_arrival_date");
    if (savedArrival) {
      const arrivalDate = new Date(savedArrival);
      const diffMs = arrivalDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const tripParkId = localStorage.getItem("wildatlas_active_park") || parkId;
      const tripParkName = PARKS[tripParkId]?.shortName || "your park";

      if (daysUntil === 1) {
        tripLine = `\n\nTomorrow's the day — here's your ${tripParkName} morning briefing.`;
      } else if (daysUntil > 1 && daysUntil <= 7) {
        tripLine = `\n\nYour ${tripParkName} trip is in ${daysUntil} days — let's make sure you're ready.`;
      } else if (daysUntil > 7) {
        tripLine = `\n\n${daysUntil} days until ${tripParkName} — here's what to know this week.`;
      }
    }

    const content = `${greeting}\n\n${body}${tripLine}`;
    sessionStorage.setItem(SESSION_KEY, "true");
    return { id: 1, role: "assistant", content };
  };

  const [messages, setMessages] = useState<Message[]>(() => [makeGreeting()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevParkRef = useRef(parkId);
  const sendTimestamps = useRef<number[]>([]);
  const pendingSendRef = useRef<string | null>(null);

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

    const history = [...messages, userMsg]
      .filter((m) => m.id !== 1)
      .map((m) => ({ role: m.role, content: m.content }));
    let assistantContent = "";
    const arrivalDate = localStorage.getItem("wildatlas_arrival_date") || null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history, arrivalDate, parkId }),
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
        errorMsg = "That took too long — the trail seems blocked right now 🐻 Try a shorter question or check back in a bit!";
      } else if (e.message === "rate_limit") {
        errorMsg = "The park service is getting a lot of questions right now 🐻 Give it a minute and try again!";
      } else if (e.message === "server_error") {
        errorMsg = "Looks like the ranger station is temporarily closed 🐻 I'll be back shortly — try again in a moment!";
      } else if (!navigator.onLine) {
        errorMsg = "You seem to be offline 🐻 Check your connection and try again when you're back on the trail!";
      } else {
        errorMsg = "I'm having trouble reaching the park gates right now 🐻 Give me a moment and try again!";
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: "assistant", content: errorMsg },
      ]);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const isBriefing = messages.length <= 2 && messages[0]?.id === 1;

  // Simplified quick prompts
  const currentParkPermits = trackedPermits.filter((p) => p.park_id === parkId);
  const primaryPermit = firstSession?.permitName || currentParkPermits[0]?.permit_name;

  const quickPrompts = primaryPermit
    ? [
        "Best time to arrive",
        "Packing checklist",
        `${primaryPermit} permit odds`,
      ]
    : [
        "Which parks have permits?",
        "Best parks to visit now",
        "Where to hike without a permit",
      ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-medium text-secondary tracking-widest uppercase">Park Guide</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-2">
        {/* ── Briefing view ── */}
        {isBriefing && (
          <div className="px-5 flex flex-col justify-center" style={{ minHeight: "calc(100% - 16px)" }}>
            {/* Mochi avatar + title */}
            <div className="text-center mb-5 mt-4">
              <div className="text-[42px] leading-none mb-4">🐻</div>
              <h1 className="text-[22px] font-heading font-bold text-foreground leading-tight">Mochi</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-1.5 font-medium">Your national parks guide</p>
            </div>

            {/* Initial greeting card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={messages[0]?.content}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-card border border-border/70 rounded-xl p-4 mb-5"
                style={{ boxShadow: "var(--card-shadow)" }}
              >
                <div className="mochi-prose text-[13px] leading-relaxed space-y-3">
                  {messages[0].content.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    return (
                      <p key={i} className="text-foreground/85 font-body">
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
                  onClick={() => { pendingSendRef.current = prompt; setInput(prompt); }}
                  className="text-[11px] font-semibold text-secondary bg-secondary/8 hover:bg-secondary/20 active:scale-[0.96] border-[1.5px] border-secondary/25 hover:border-secondary/40 rounded-full px-4 py-2 transition-all duration-150 max-w-full"
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
                  className={`max-w-[85%] px-4 py-3.5 text-[13px] leading-[1.7] ${
                    msg.role === "assistant"
                      ? "bg-card text-card-foreground border border-border/70 rounded-xl rounded-tl-sm shadow-sm"
                      : "bg-primary text-primary-foreground rounded-xl rounded-tr-sm shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Bot size={12} className="text-secondary opacity-60" />
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
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start px-5 mt-3">
            <div className="bg-card border border-border/70 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "0.6s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "0.6s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "0.6s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Sticky chat input */}
      <div className="sticky bottom-0 bg-background border-t border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 bg-card border border-border/70 rounded-xl px-4 py-2.5" style={{ boxShadow: "0 -2px 12px -4px hsl(var(--foreground) / 0.04)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Mochi about parks, permits, or trails..."
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

import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import ParkSelector from "@/components/ParkSelector";
import ParkInsightsCards from "@/components/ParkInsightsCards";

/** Convert inline and line-start bullet patterns using • into proper markdown lists */
const formatInlineBullets = (text: string): string => {
  // First: convert inline bullets (e.g. "Label: • A • B • C") into multi-line list
  let result = text.replace(
    /^(.+?:)\s*•\s*(.+)$/gm,
    (_match, label: string, rest: string) => {
      const items = rest.split(/\s*•\s*/).filter(Boolean);
      if (items.length < 2) return _match;
      return `${label}\n${items.map((item) => `- ${item.trim()}`).join("\n")}`;
    }
  );
  // Then: convert any remaining lines starting with • into markdown list items
  result = result.replace(/^•\s+/gm, "- ");
  return result;
};

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mochi-chat`;
const SESSION_KEY = "mochi_introduced";

const MochiChat = ({ parkId = "yosemite", onParkChange }: { parkId?: string; onParkChange?: (id: string) => void }) => {
  const { displayName, user } = useAuth();
  const parkName = PARKS[parkId]?.shortName ?? "the park";

  const makeGreeting = (): Message => {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const quietAreas: Record<string, string[]> = {
      yosemite: hour < 10 ? ["Glacier Point", "Tuolumne Meadows"] : hour < 15 ? ["Mirror Lake", "Mariposa Grove"] : ["Valley View", "Sentinel Bridge"],
      rainier: hour < 10 ? ["Sunrise Point", "Grove of the Patriarchs"] : hour < 15 ? ["Ohanapecosh", "Carbon River"] : ["Reflection Lakes", "Tipsoo Lake"],
      zion: hour < 10 ? ["Canyon Overlook", "Kolob Canyons"] : hour < 15 ? ["Riverside Walk", "Pa'rus Trail"] : ["Watchman Trail", "Court of the Patriarchs"],
      glacier: hour < 10 ? ["Logan Pass", "Avalanche Lake"] : hour < 15 ? ["St. Mary Falls", "Running Eagle Falls"] : ["Lake McDonald", "Apgar Village"],
      rocky_mountain: hour < 10 ? ["Bear Lake", "Sprague Lake"] : hour < 15 ? ["Dream Lake", "Emerald Lake"] : ["Moraine Park", "Horseshoe Park"],
      arches: hour < 10 ? ["Delicate Arch viewpoint", "Devils Garden"] : hour < 15 ? ["Park Avenue", "Balanced Rock"] : ["Windows Section", "Sand Dune Arch"],
    };

    const crowdNote: Record<string, string> = {
      yosemite: hour < 10 ? "Crowds build after **10 AM**." : hour < 15 ? "Valley lots full — use shuttle or return evening." : "Crowds thinning — good window until sunset.",
      rainier: hour < 10 ? "Paradise lot fills by **10 AM** weekends." : hour < 15 ? "Paradise at capacity. Try Sunrise." : "Trails clearing — evening quiet settling in.",
      zion: hour < 10 ? "Shuttle lines build after **9 AM**." : hour < 15 ? "Angels Landing queue **2+ hours**. Try Observation Point." : "Last shuttle at sunset — trails clearing.",
      glacier: hour < 10 ? "Going-to-the-Sun fills by **8 AM** summer." : hour < 15 ? "Logan Pass full. Try Many Glacier." : "Golden hour at Lake McDonald — crowds easing.",
      rocky_mountain: hour < 10 ? "Timed entry required. Bear Lake fills early." : hour < 15 ? "Bear Lake full. Try Wild Basin." : "Elk appearing in Moraine Park at dusk.",
      arches: hour < 10 ? "Timed entry starts **7 AM**. Arrive early." : hour < 15 ? "Delicate Arch packed. Try Devils Garden." : "Sunset at Delicate Arch — arrive by **5 PM**.",
    };

    const statusWord = hour < 10 ? "quiet right now" : hour < 15 ? "getting busy" : "winding down";
    const areas = quietAreas[parkId] ?? quietAreas.yosemite;
    const crowd = crowdNote[parkId] ?? crowdNote.yosemite;

    const content = `Good ${timeOfDay}. ${parkName} is ${statusWord}.\n\n**Best quiet areas right now:**\n• ${areas[0]}\n• ${areas[1]}\n\n${crowd}`;

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

  // Reset conversation with contextual greeting when park changes
  useEffect(() => {
    if (parkId !== prevParkRef.current) {
      prevParkRef.current = parkId;
      setMessages([makeGreeting()]);
    }
  }, [parkId, parkName, displayName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send when pendingSendRef is set and input has been updated
  useEffect(() => {
    if (pendingSendRef.current && input === pendingSendRef.current && !isLoading) {
      pendingSendRef.current = null;
      handleSend();
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || rateLimited) return;

    // Rate limit: max 5 messages per 60 seconds
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
        if (resp.status === 429) {
          throw new Error("rate_limit");
        }
        if (resp.status >= 500) {
          throw new Error("server_error");
        }
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

  const quickPrompts = [
    "Best sunrise hikes",
    "When are crowds lowest",
    "Do I need permits today",
    "Which trails are snow free",
    "What roads are closed",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-secondary tracking-widest uppercase">Park Guide</p>
          <ParkSelector activeParkId={parkId} onParkChange={onParkChange ?? (() => {})} />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-2">
        {/* ── Briefing view: conversation-first layout ── */}
        {isBriefing && (
          <div className="px-5 flex flex-col justify-center" style={{ minHeight: "calc(100% - 16px)" }}>
            {/* Mochi avatar + title — centered hero */}
            <div className="text-center mb-5 mt-4">
              <div className="text-[42px] leading-none mb-2">🐻</div>
              <h1 className="text-[22px] font-heading font-bold text-foreground leading-tight">Mochi</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-1 font-medium">Your {parkName} guide</p>
            </div>

            {/* Initial greeting bubble */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border/70 rounded-xl px-4 py-4 mb-5"
              style={{ boxShadow: "var(--card-shadow)" }}
            >
              <div className="mochi-prose text-[13px] leading-[1.7]">
                <ReactMarkdown>{formatInlineBullets(messages[0].content)}</ReactMarkdown>
              </div>
            </motion.div>

            {/* Suggestion chips — directly below, single group */}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  onClick={() => { pendingSendRef.current = prompt; setInput(prompt); }}
                  className="text-[11px] font-semibold text-secondary bg-secondary/8 hover:bg-secondary/20 active:scale-[0.96] border-[1.5px] border-secondary/25 hover:border-secondary/40 rounded-full px-4 py-2 transition-all duration-150"
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

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start px-5 mt-3">
            <div className="bg-card border border-border/70 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader2 size={14} className="animate-spin text-secondary" />
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
            placeholder="Ask Mochi about trails, permits, crowds, or road conditions"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MochiChat;
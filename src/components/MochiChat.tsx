import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PARKS } from "@/lib/parks";
import ParkSelector from "@/components/ParkSelector";
import ParkInsightsCards from "@/components/ParkInsightsCards";

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

    // Build contextual briefing based on time of day and park
    const quietAreas: Record<string, string[]> = {
      yosemite: hour < 10 ? ["Glacier Point", "Tuolumne Meadows"] : hour < 15 ? ["Mirror Lake", "Mariposa Grove"] : ["Valley View", "Sentinel Bridge"],
      rainier: hour < 10 ? ["Sunrise Point", "Grove of the Patriarchs"] : hour < 15 ? ["Ohanapecosh", "Carbon River"] : ["Reflection Lakes", "Tipsoo Lake"],
      zion: hour < 10 ? ["Canyon Overlook", "Kolob Canyons"] : hour < 15 ? ["Riverside Walk", "Pa'rus Trail"] : ["Watchman Trail", "Court of the Patriarchs"],
      glacier: hour < 10 ? ["Logan Pass", "Avalanche Lake"] : hour < 15 ? ["St. Mary Falls", "Running Eagle Falls"] : ["Lake McDonald", "Apgar Village"],
      rocky: hour < 10 ? ["Bear Lake", "Sprague Lake"] : hour < 15 ? ["Dream Lake", "Emerald Lake"] : ["Moraine Park", "Horseshoe Park"],
      arches: hour < 10 ? ["Delicate Arch viewpoint", "Devils Garden"] : hour < 15 ? ["Park Avenue", "Balanced Rock"] : ["Windows Section", "Sand Dune Arch"],
    };

    const crowdNote: Record<string, string> = {
      yosemite: hour < 10 ? "Crowds increase after **10 AM**." : hour < 15 ? "Valley lots are full. Consider shuttle or evening return." : "Crowds thinning — good window until sunset.",
      rainier: hour < 10 ? "Paradise lot fills by **10 AM** on weekends." : hour < 15 ? "Paradise is at capacity. Try Sunrise or Carbon River." : "Evening quiet settling in — trails clearing.",
      zion: hour < 10 ? "Shuttle lines build after **9 AM**." : hour < 15 ? "Angels Landing queue is **2+ hours**. Consider Observation Point." : "Last shuttle runs at sunset — trails clearing.",
      glacier: hour < 10 ? "Going-to-the-Sun Road fills by **8 AM** in summer." : hour < 15 ? "Logan Pass lot is full. Try Many Glacier." : "Golden hour light at Lake McDonald — crowds easing.",
      rocky: hour < 10 ? "Timed entry required. Bear Lake corridor fills early." : hour < 15 ? "Bear Lake lots full. Try Wild Basin or Lumpy Ridge." : "Elk start appearing in Moraine Park at dusk.",
      arches: hour < 10 ? "Timed entry starts **7 AM**. Arrive early." : hour < 15 ? "Delicate Arch trail is packed. Try Devils Garden." : "Sunset at Delicate Arch — arrive by **5 PM**.",
    };

    const areas = quietAreas[parkId] ?? quietAreas.yosemite;
    const crowd = crowdNote[parkId] ?? crowdNote.yosemite;

    const content = `Good ${timeOfDay}. ${parkName} is ${hour < 10 ? "quiet right now" : hour < 15 ? "getting busy today" : "winding down"}.\n\n**Best quiet areas right now:**\n• ${areas[0]}\n• ${areas[1]}\n\n${crowd}`;

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

  // Reset conversation with contextual greeting when park changes
  useEffect(() => {
    if (parkId !== prevParkRef.current) {
      prevParkRef.current = parkId;
      // Re-generate a full contextual greeting for the new park
      setMessages([makeGreeting()]);
    }
  }, [parkId, parkName, displayName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
      .filter((m) => m.id !== 1) // exclude the client-side greeting from API history
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
        body: JSON.stringify({ messages: history, userId: user?.id, arrivalDate, parkId }),
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-secondary tracking-widest uppercase">Park Guide</p>
          <ParkSelector activeParkId={parkId} onParkChange={onParkChange ?? (() => {})} />
        </div>
        <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">Mochi 🐻</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ask anything about {parkName}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-2 mt-1">
        {/* Initial briefing view */}
        {messages.length <= 2 && messages[0]?.id === 1 && (
          <div className="px-5 space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-lg px-4 py-3.5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Bot size={13} className="text-secondary" />
                <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Mochi</span>
              </div>
              <div className="prose prose-sm max-w-none text-card-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 text-[13px] leading-[1.7]">
                <ReactMarkdown>{messages[0].content}</ReactMarkdown>
              </div>
            </motion.div>

            <ParkInsightsCards parkId={parkId} />

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Quick Questions</p>
              <div className="flex flex-wrap gap-2.5">
                 {[
                   "Best sunrise hikes",
                   "When are crowds lowest",
                   "Which trails are snow free",
                   "Do I need permits today",
                   "What roads are closed",
                 ].map((prompt) => (
                   <button
                     key={prompt}
                     onClick={() => { setInput(prompt); setTimeout(() => { setInput(prompt); handleSendDirect(prompt); }, 0); }}
                     className="text-[11px] font-semibold text-secondary bg-secondary/8 hover:bg-secondary/20 active:scale-[0.96] border-[1.5px] border-secondary/25 hover:border-secondary/40 rounded-lg px-4 py-2.5 transition-all duration-150"
                   >
                     {prompt}
                   </button>
                 ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Popular Questions Today</p>
              <div className="flex flex-wrap gap-2.5">
                 {[
                   `Best sunrise viewpoints in ${parkName}`,
                   `Is ${parkName} busy right now`,
                   "Where are crowds lowest right now",
                   "Do I need a reservation today",
                 ].map((prompt) => (
                   <button
                     key={prompt}
                     onClick={() => { setInput(prompt); setTimeout(() => { setInput(prompt); handleSendDirect(prompt); }, 0); }}
                     className="text-[11px] font-semibold text-muted-foreground bg-muted/50 hover:bg-muted active:scale-[0.96] border-[1.5px] border-border hover:border-border/80 rounded-lg px-4 py-2.5 transition-all duration-150"
                   >
                     {prompt}
                   </button>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation view */}
        {(messages.length > 2 || messages[0]?.id !== 1) && (
          <div className="px-5 space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 text-[13px] leading-[1.7] ${
                    msg.role === "assistant"
                      ? "bg-card text-card-foreground border border-border rounded-lg rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-lg rounded-tr-sm"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot size={13} className="text-secondary" />
                      <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Mochi</span>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-card-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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
            <div className="bg-card border border-border rounded-lg rounded-tl-sm px-4 py-3">
              <Loader2 size={14} className="animate-spin text-secondary" />
            </div>
          </div>
        )}
      </div>

      {/* Sticky chat input */}
      <div className="sticky bottom-0 bg-background border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask Mochi about trails, crowds, permits, or road conditions..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MochiChat;

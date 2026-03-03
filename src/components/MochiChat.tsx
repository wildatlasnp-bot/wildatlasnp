import { useState, useRef, useEffect } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mochi-chat`;
const SESSION_KEY = "mochi_introduced";

const MochiChat = () => {
  const { displayName } = useAuth();

  const getInitialGreeting = (): Message => {
    const hasIntroduced = sessionStorage.getItem(SESSION_KEY) === "true";
    const nameStr = displayName ? `, ${displayName}` : "";
    if (hasIntroduced) {
      return {
        id: 1,
        role: "assistant",
        content: `How can I help with your Yosemite planning today${nameStr}? 🐻`,
      };
    }
    sessionStorage.setItem(SESSION_KEY, "true");
    return {
      id: 1,
      role: "assistant",
      content: `Hey${nameStr}! I'm Mochi 🐻 Ready to navigate the 2026 Yosemite season?`,
    };
  };

  const [messages, setMessages] = useState<Message[]>(() => [getInitialGreeting()]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Stream failed" }));
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
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, role: "assistant", content: `Apologies — something went wrong. ${e.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-medium text-secondary tracking-widest uppercase mb-1">Global Concierge</p>
        <h1 className="text-[26px] font-heading font-bold text-foreground leading-tight">Mochi</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 mt-2">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-card text-card-foreground border border-border"
                  : "bg-primary text-primary-foreground"
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
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <Loader2 size={14} className="animate-spin text-secondary" />
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2.5 shadow-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about trails, permits…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MochiChat;

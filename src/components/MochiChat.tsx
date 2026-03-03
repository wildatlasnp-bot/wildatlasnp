import { useState } from "react";
import { Send, Bot } from "lucide-react";
import { motion } from "framer-motion";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
}

const initialMessages: Message[] = [
  {
    id: 1,
    text: "Hey there! I'm Mochi 🐻 your Yosemite trail buddy. Ask me anything about trails, weather, or wildlife!",
    isBot: true,
  },
];

const MochiChat = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), text: input, isBot: false };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Great question! The Mist Trail to Vernal Fall is about 5.4 miles round trip. Best to start early — it gets crowded after 9 AM. Don't forget rain gear near the waterfall! 🌊",
          isBot: true,
        },
      ]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Mochi</h1>
        <p className="text-sm text-muted-foreground">Your AI trail companion</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.isBot
                  ? "bg-card text-card-foreground border border-border"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {msg.isBot && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bot size={14} className="text-secondary" />
                  <span className="text-xs font-semibold text-secondary">Mochi</span>
                </div>
              )}
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about trails, permits…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={handleSend}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MochiChat;

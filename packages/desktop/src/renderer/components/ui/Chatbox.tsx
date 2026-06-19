import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNexus } from "../../contexts/NexusContext";
import type { MessageView } from "../../lib/nexus-types";

export function Chatbox() {
  const nexus = useNexus();
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    nexus.getMessages().then(setMessages);
  }, [nexus]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;

    setInput("");
    setIsProcessing(true);

    try {
      await nexus.executeIntent("chat", { text });
      const updated = await nexus.getMessages();
      setMessages(updated);
    } catch {
      const errMsg: MessageView = {
        id: `e-${Date.now()}`,
        type: "system",
        text: "Command processing failed.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, nexus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="chatbox-panel">
      <div className="chat-header">COM_LINK // SECURE_CHANNEL</div>

      <div className="chat-history" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className={`chat-msg chat-msg--${msg.type}`}
            >
              {msg.type === "user" && (
                <span className="chat-prefix chat-prefix--user">USER_ // </span>
              )}
              {msg.type === "jarvis" && (
                <span className="chat-prefix chat-prefix--jarvis">J.A.R.V.I.S_ // </span>
              )}
              {msg.type === "system" && (
                <span className="chat-prefix chat-prefix--system">SYS_ // </span>
              )}
              {msg.text}
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <div className="chat-msg chat-msg--jarvis">
            <span className="chat-prefix chat-prefix--jarvis">J.A.R.V.I.S_ // </span>
            <span className="typing-indicator">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          data-testid="chat-input"
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          autoComplete="off"
          disabled={isProcessing}
        />
      </div>
    </div>
  );
}

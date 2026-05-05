import { useState, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { backendStorage } from "../lib/backendStorage";

export function ChatboxWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatboxUrl, setChatboxUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const settings = backendStorage.getItem("chatboxSettings");
    if (settings) {
      const parsed = JSON.parse(settings);
      setChatboxUrl(parsed.url || "");
      setIsEnabled(parsed.enabled || false);
    }

    // Escuchar cambios en backendStorage
    const handleStorageChange = () => {
      const settings = backendStorage.getItem("chatboxSettings");
      if (settings) {
        const parsed = JSON.parse(settings);
        setChatboxUrl(parsed.url || "");
        setIsEnabled(parsed.enabled || false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (!isEnabled || !chatboxUrl) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chatbox Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-96 h-[600px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <h3 className="font-semibold">Asistente IA</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-primary-foreground/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Iframe */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={chatboxUrl}
                className="w-full h-full border-0"
                title="Chatbox IA"
                allow="microphone; camera"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

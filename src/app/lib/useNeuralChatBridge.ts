import { useEffect, useMemo } from "react";
import { backendApi } from "./backendStorage";

function expectedOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

type ChatEventMessage = {
  source?: string;
  type?: string;
  event?: string;
  conversationId?: string;
  text?: string;
  message?: string;
  intent?: string;
  topic?: string;
  suggestion?: string;
};

export function useNeuralChatBridge(chatUrl: string, enabled = true) {
  const origin = useMemo(() => expectedOrigin(chatUrl), [chatUrl]);

  useEffect(() => {
    if (!enabled || !origin) return;

    const handler = (event: MessageEvent<ChatEventMessage>) => {
      if (event.origin !== origin) return;
      const data = event.data || {};
      if (!data || typeof data !== "object") return;

      const source = String(data.source || "");
      if (!["herencia-chat", "herencia-ia", "chatbox"].includes(source)) return;

      const rawType = String(data.type || data.event || "");
      const typeMap: Record<string, "conversation.message" | "conversation.unanswered" | "conversation.intent" | "web.demand_signal"> = {
        message: "conversation.message",
        "conversation.message": "conversation.message",
        unanswered: "conversation.unanswered",
        "conversation.unanswered": "conversation.unanswered",
        intent: "conversation.intent",
        "conversation.intent": "conversation.intent",
        demand: "web.demand_signal",
        "web.demand_signal": "web.demand_signal",
      };
      const type = typeMap[rawType];
      if (!type) return;

      void backendApi.neuralCustomerChatEvent({
        type,
        conversationId: data.conversationId,
        text: String(data.text || data.message || ""),
        intent: data.intent,
        topic: data.topic,
        suggestion: data.suggestion,
        page: window.location.pathname,
      }).catch(() => {
        // Neural learning must never interrupt the customer chat experience.
      });
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [enabled, origin]);
}

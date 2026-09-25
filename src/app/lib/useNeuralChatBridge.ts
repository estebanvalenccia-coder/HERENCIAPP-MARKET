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

      const nested = (data as any).payload && typeof (data as any).payload === "object" ? (data as any).payload : {};
      const source = String(data.source || nested.source || "");
      if (source && !["herencia-chat", "herencia-ia", "chatbox"].includes(source)) return;

      const rawType = String(data.type || data.event || nested.type || nested.event || "");
      const typeMap: Record<string, "conversation.message" | "conversation.unanswered" | "conversation.intent" | "web.demand_signal"> = {
        message: "conversation.message",
        user_message: "conversation.message",
        customer_message: "conversation.message",
        "conversation.message": "conversation.message",
        unanswered: "conversation.unanswered",
        no_answer: "conversation.unanswered",
        "conversation.unanswered": "conversation.unanswered",
        intent: "conversation.intent",
        "conversation.intent": "conversation.intent",
        demand: "web.demand_signal",
        "web.demand_signal": "web.demand_signal",
      };
      const inferredText = String(data.text || data.message || nested.text || nested.message || "");
      const type = typeMap[rawType] || (!rawType && inferredText ? "conversation.message" : undefined);
      if (!type) return;

      void backendApi.neuralCustomerChatEvent({
        type,
        conversationId: data.conversationId || nested.conversationId || nested.sessionId,
        text: inferredText,
        intent: data.intent || nested.intent,
        topic: data.topic || nested.topic,
        suggestion: data.suggestion || nested.suggestion,
        page: window.location.pathname,
      }).catch(() => {
        // Neural learning must never interrupt the customer chat experience.
      });
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [enabled, origin]);
}

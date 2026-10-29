import React from "react";

const DEFAULT_PHONE = "34624239598";
const DEFAULT_MESSAGE = "Hola, vengo de Tropical Plants y necesito ayuda con un producto.";

export function WhatsAppFloatingButton({
  phone = DEFAULT_PHONE,
  message = DEFAULT_MESSAGE,
  position = "left",
  bottomOffset = 24,
  color = "#25D366",
}: {
  phone?: string;
  message?: string;
  position?: "left" | "right";
  bottomOffset?: number;
  color?: string;
} = {}) {
  const path = typeof window === "undefined" ? "" : window.location.pathname.toLowerCase();
  if (/^\/(admin|administracion|administración|dashboard)(\/|$)/.test(path)) return null;
  const digits = String(phone || "").replace(/\D/g, "") || DEFAULT_PHONE;
  const text = String(message || DEFAULT_MESSAGE).slice(0, 500);
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  const offset = Math.max(12, Math.min(300, Number(bottomOffset) || 24));
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#25D366";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar con Tropical Plants por WhatsApp"
      title="¿Necesitas ayuda? Escríbenos por WhatsApp"
      style={{
        position: "fixed",
        ...(position === "right" ? { right: 20 } : { left: 20 }),
        bottom: offset,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 58,
        height: 58,
        background: safeColor,
        color: "#FFFFFF",
        borderRadius: "50%",
        boxShadow: "0 5px 20px rgba(0,0,0,.22)",
        textDecoration: "none",
      }}
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z"/>
        <path d="M9 9c.3 2.7 2.2 4.6 5 5"/>
      </svg>
    </a>
  );
}

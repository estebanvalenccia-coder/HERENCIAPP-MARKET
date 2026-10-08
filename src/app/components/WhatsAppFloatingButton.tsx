import React from "react";

const WHATSAPP_URL = "https://wa.me/34624239598?text=" + encodeURIComponent("Hola, vengo de Herencia Market y necesito ayuda con un producto.");

/** Direct click-to-chat; no WhatsApp Cloud API or credentials required. */
export function WhatsAppFloatingButton() {
  const path = typeof window === "undefined" ? "" : window.location.pathname.toLowerCase();
  if (/^\/(admin|administracion|administración|dashboard)(\/|$)/.test(path)) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hablar con Herencia Market por WhatsApp"
      title="¿Necesitas ayuda? Escríbenos por WhatsApp"
      style={{ position: "fixed", right: 20, bottom: 24, zIndex: 60, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, background: "#25D366", color: "#102b1b", padding: "13px 17px", borderRadius: 999, boxShadow: "0 5px 20px rgba(0,0,0,.22)", fontSize: 14, fontWeight: 700, textDecoration: "none" }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M9 9c.3 2.7 2.2 4.6 5 5"/></svg>
      <span>WhatsApp</span>
    </a>
  );
}

/** Preserve the configured sender address, while using the current store display name. */
export function tropicalEmailSender(configured = "") {
  const raw = String(configured || "").trim();
  const bracketed = raw.match(/<([^<>\s]+@[^<>\s]+)>$/);
  const address = bracketed?.[1] || (/^[^\s<>@]+@[^\s<>@]+$/.test(raw) ? raw : "onboarding@resend.dev");
  return `Tropical Plants <${address}>`;
}

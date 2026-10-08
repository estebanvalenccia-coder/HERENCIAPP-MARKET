/** Private support records are only available through authenticated support routes. */
export function isPrivateSupportStorageKey(key) {
  const value = String(key || "");
  return value === "customerSupportIndex" ||
    value === "customerSupportTicketIndex" ||
    value.startsWith("customerSupport:") ||
    value.startsWith("customerSupportTicket:") ||
    value.startsWith("customerSupportAttachment:");
}

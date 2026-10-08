/** Private chat storage must only be accessed through authenticated support routes. */
export function isPrivateSupportStorageKey(key) {
  const value = String(key || "");
  return value === "customerSupportIndex" || value.startsWith("customerSupport:");
}

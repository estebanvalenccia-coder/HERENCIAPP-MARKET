/**
 * Internal CJ/supplier action-ledger keys must never be addressable from the
 * generic web storage API, including from an admin session. Only the trusted
 * server-side Neon routines can read/mutate these records.
 */
const PRIVATE_SUPPLIER_PREFIXES=Object.freeze([
  "cjmanualexternalaction:",
  "cjtrackingreadonlylease:",
  "supplierwebhookdispatch:",
]);
export function isPrivateSupplierStorageKey(key){
  const value=String(key??"").trim().toLowerCase();
  return PRIVATE_SUPPLIER_PREFIXES.some(prefix=>value.startsWith(prefix));
}

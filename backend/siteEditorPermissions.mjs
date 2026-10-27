const ACTIONS = new Set(["site:read", "site:edit", "site:publish", "site:restore", "site:audit", "site:permissions"]);
const DEFAULTS = {
  owner: ["site:read", "site:edit", "site:publish", "site:restore", "site:audit", "site:permissions"],
  admin: ["site:read", "site:edit", "site:publish", "site:restore", "site:audit"],
  employee: ["site:read"],
};
export function canEditSite(principal, action, restrictions = {}) {
  if (!principal || principal.mustChangePassword || principal.authenticated === false || !ACTIONS.has(action)) return false;
  const role = String(principal.role || "").toLowerCase();
  if (!Array.isArray(DEFAULTS[role]) || !DEFAULTS[role].includes(action)) return false;
  if (role === "owner") return true;
  if (action === "site:publish" && restrictions.canPublish === false) return false;
  if (action === "site:restore" && restrictions.canRestore === false) return false;
  if (action === "site:audit" && restrictions.canViewAudit === false) return false;
  return true;
}
export const SITE_PERMISSION_ACTIONS = [...ACTIONS];

import crypto from "node:crypto";

const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,31}$/;
const ROLES = new Set(["owner", "admin", "employee"]);

export function normalizeAdminUsername(value) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw new Error("Nombre de usuario no válido");
  return username;
}

export function validateAdminRole(value) {
  if (!ROLES.has(value)) throw new Error("Rol administrativo no válido");
  return value;
}

export function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
    throw new Error("La contraseña debe contener entre 12 y 1024 caracteres");
  }
  const salt = crypto.randomBytes(24);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt-v1:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export function verifyAdminPassword(password, record) {
  if (typeof password !== "string" || typeof record !== "string") return false;
  const match = /^scrypt-v1:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(record);
  if (!match) return false;
  const salt = Buffer.from(match[1], "base64url");
  const expected = Buffer.from(match[2], "base64url");
  if (salt.length !== 24 || expected.length !== 64) return false;
  const actual = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export function createPendingAdmin(username, role = "admin", email = null) {
  return {
    id: crypto.randomUUID(),
    username: normalizeAdminUsername(username),
    role: validateAdminRole(role),
    email: email || null,
    state: "pending",
    passwordHash: null,
    createdAt: new Date().toISOString(),
    passwordChangedAt: null,
    sessionVersion: 0,
  };
}

export function sanitizeAdminAccount(account) {
  const { id, username, role, email, state, createdAt, passwordChangedAt } = account;
  return { id, username, role, email, state, createdAt, passwordChangedAt };
}

export function changeAdminPassword(account, currentPassword, nextPassword) {
  if (account.state !== "active" || !verifyAdminPassword(currentPassword, account.passwordHash)) {
    throw new Error("Contraseña actual incorrecta");
  }
  return {
    ...account,
    passwordHash: hashAdminPassword(nextPassword),
    passwordChangedAt: new Date().toISOString(),
    sessionVersion: (account.sessionVersion || 0) + 1,
  };
}

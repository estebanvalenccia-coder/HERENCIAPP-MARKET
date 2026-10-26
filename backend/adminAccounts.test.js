import test from "node:test";
import assert from "node:assert/strict";
import { createPendingAdmin, hashAdminPassword, verifyAdminPassword, changeAdminPassword, sanitizeAdminAccount, normalizeAdminUsername, canAdminSignIn, activateAdminAccount, canAccessAdminSettings } from "./adminAccounts.js";

test("Christian se prepara sin contraseña ni acceso activo", () => {
  const c = createPendingAdmin("christian", "admin");
  assert.equal(c.username, "christian");
  assert.equal(c.role, "admin");
  assert.equal(c.state, "pending");
  assert.equal(c.passwordHash, null);
  assert.equal(c.email, null);
});
test("no permite nombres peligrosos ni roles arbitrarios", () => {
  assert.throws(() => normalizeAdminUsername("../../../admin"));
  assert.throws(() => createPendingAdmin("christian", "ownerish"));
});
test("contraseñas se almacenan como hash con salt", () => {
  const a = hashAdminPassword("contraseña-muy-larga-2026");
  const b = hashAdminPassword("contraseña-muy-larga-2026");
  assert.notEqual(a, b);
  assert.equal(verifyAdminPassword("contraseña-muy-larga-2026", a), true);
  assert.equal(verifyAdminPassword("incorrecta", a), false);
  assert.equal(verifyAdminPassword("contraseña-muy-larga-2026", "invalid"), false);
});
test("cambiar contraseña revoca versión de sesión y no filtra hash", () => {
  const pending = createPendingAdmin("christian", "admin");
  const original = { ...pending, state: "active", passwordHash: hashAdminPassword("anterior-contraseña-2026") };
  const updated = changeAdminPassword(original, "anterior-contraseña-2026", "nueva-contraseña-2026");
  assert.equal(updated.sessionVersion, 1);
  assert.equal(verifyAdminPassword("nueva-contraseña-2026", updated.passwordHash), true);
  assert.equal(verifyAdminPassword("anterior-contraseña-2026", updated.passwordHash), false);
  assert.equal(Object.hasOwn(sanitizeAdminAccount(updated), "passwordHash"), false);
  assert.throws(() => changeAdminPassword(original, "incorrecta", "nueva-contraseña-2026"));
});

test("el usuario pendiente no inicia sesión y el primer acceso exige actualizar clave", () => {
  const pending = createPendingAdmin("christian", "admin");
  assert.equal(canAdminSignIn(pending), false);
  const activated = activateAdminAccount(pending, "una-frase-secreta-de-primer-acceso");
  assert.equal(canAdminSignIn(activated), true);
  assert.equal(canAccessAdminSettings(activated), false);
  assert.equal(activated.mustChangePassword, true);
  assert.throws(() => activateAdminAccount(activated, "otra-frase-secreta"));
});

test("1234 solo es válida como contraseña temporal, no como clave definitiva", () => {
  const pending = createPendingAdmin("christian", "admin");
  assert.throws(() => hashAdminPassword("1234"));
  const activated = activateAdminAccount(pending, "1234", { temporary: true });
  assert.equal(verifyAdminPassword("1234", activated.passwordHash), true);
  assert.equal(canAccessAdminSettings(activated), false);
  assert.throws(() => changeAdminPassword(activated, "1234", "1234"));
  const changed = changeAdminPassword(activated, "1234", "otra-clave-muy-segura-2026");
  assert.equal(changed.mustChangePassword, false);
  assert.equal(changed.sessionVersion, activated.sessionVersion + 1);
  assert.equal(verifyAdminPassword("1234", changed.passwordHash), false);
  assert.equal(canAccessAdminSettings(changed), true);
});

import { normalizeCommit } from "./deploymentParity.js";
// Pure fleet comparison: READY and deployment dates never prove identical source.
export function compareDeploymentFleet(readings, expectedSha = null) {
  const expected = normalizeCommit(expectedSha);
  const names = ["public", "vercel", "railway", "backend"];
  const components = Object.fromEntries(names.map(name => {
    const r = readings?.[name] || {};
    return [name, { ok: r.ok === true, commit: normalizeCommit(r.commit), platform: typeof r.platform === "string" ? r.platform : "unknown", error: typeof r.error === "string" ? r.error : null }];
  }));
  const commits = names.map(name => components[name].commit);
  const missing = names.filter(name => !components[name].ok || !components[name].commit);
  const differing = expected ? names.filter(name => components[name].commit && components[name].commit !== expected) : [];
  const state = missing.length ? "unverified" : new Set(commits).size !== 1 || differing.length ? "drift" : "synced";
  return { state, synced: state === "synced", expectedCommit: expected, components, missing, differing };
}

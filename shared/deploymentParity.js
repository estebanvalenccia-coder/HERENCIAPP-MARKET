// Compare immutable Git commits only. A timestamp or a deployment's READY status is not proof of parity.
export function normalizeCommit(commit) {
  const sha = String(commit ?? "").trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(sha) ? sha : null;
}

export function compareDeploymentVersions(frontend, backend) {
  const frontendCommit = normalizeCommit(frontend?.commit);
  const backendCommit = normalizeCommit(backend?.commit);
  const state = !frontendCommit || !backendCommit
    ? "unverified"
    : frontendCommit === backendCommit ? "synced" : "drift";
  return {
    state,
    synced: state === "synced",
    frontendCommit,
    backendCommit,
    frontendPlatform: typeof frontend?.platform === "string" ? frontend.platform : "unknown",
    backendPlatform: typeof backend?.platform === "string" ? backend.platform : "unknown",
  };
}

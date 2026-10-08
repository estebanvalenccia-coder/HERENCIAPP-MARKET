import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCommit, compareDeploymentVersions } from "../shared/deploymentParity.js";

const a = "224bb108ef88fdc20e15d463950f3d888b16e503";
const b = "62ee28fc27880d0d000c9e47df95fd14430a980d";

test("accept only exact immutable 40-character commit SHA", () => {
  assert.equal(normalizeCommit(a), a);
  assert.equal(normalizeCommit(a.toUpperCase()), a);
  for (const value of ["", "main", "READY", "1234567", null, undefined, "g".repeat(40)]) {
    assert.equal(normalizeCommit(value), null);
  }
});

test("same deployed commit means frontend and API agree", () => {
  assert.deepEqual(compareDeploymentVersions({ commit: a, platform: "vercel" }, { commit: a, platform: "railway" }), {
    state: "synced", synced: true, frontendCommit: a, backendCommit: a, frontendPlatform: "vercel", backendPlatform: "railway"
  });
});

test("stale Vercel frontend versus newer Railway backend must alert", () => {
  const check = compareDeploymentVersions({ commit: b, platform: "vercel" }, { commit: a, platform: "railway" });
  assert.equal(check.state, "drift");
  assert.equal(check.synced, false);
});

test("READY without build provenance cannot be mistaken for synced", () => {
  assert.equal(compareDeploymentVersions({state: "READY"}, {commit:a}).state, "unverified");
  assert.equal(compareDeploymentVersions({commit:a}, {}).state, "unverified");
});

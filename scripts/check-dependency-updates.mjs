import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const workflow = parse(readFileSync(new URL("../.github/workflows/dependabot-automerge.yml", import.meta.url), "utf8"));
const actions = workflow.jobs.automerge.steps.filter((step) => step.run?.startsWith("gh pr "));
assert.equal(actions.length, 2);
assert.equal(actions[0].if, actions[1].if, "approval and merge must have the same gate");
// Evaluate this repository's checked-in expression, never a PR payload.
const allowed = new Function("contains", "names", "type", `return (${actions[0].if
  .replaceAll("steps.meta.outputs.dependency-names", "names")
  .replaceAll("steps.meta.outputs.update-type", "type")});`);
const contains = (names, name) => names.includes(name);
for (const level of ["patch", "minor", "digest", "major"]) {
  const type = `version-update:semver-${level}`;
  assert.equal(allowed(contains, "hono, zod", type), level !== "major");
  for (const names of ["better-auth", "hono, better-auth", "@better-auth/core"]) {
    assert.equal(allowed(contains, names, type), false, `${names} must be reviewed with Core`);
  }
}
const config = parse(readFileSync(new URL("../.github/dependabot.yml", import.meta.url), "utf8"));
const npm = config.updates.find((update) => update["package-ecosystem"] === "npm");
assert(!npm.ignore.some((rule) => rule["dependency-name"].includes("better-auth")), "keep auth update PRs visible");
assert(!npm.groups["runtime-libs"].patterns.includes("better-auth"));
console.log("dependency update gates passed");

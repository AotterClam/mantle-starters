#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const [commit, version, coreSha, parent] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(commit ?? "") ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "") ||
    !/^[0-9a-f]{40}$/.test(coreSha ?? "") ||
    !/^[0-9a-f]{40}$/.test(parent ?? "")) {
  throw new Error("usage: check-release-candidate.mjs <commit> <version> <core-sha> <parent-sha>");
}

for (const path of ["package.json", "blank/package.json", "recipes/typed-web/package.json"]) {
  const pkg = JSON.parse(show(path));
  if (pkg.version !== version) throw new Error(`${path}: version ${pkg.version} != ${version}`);
  if (path === "package.json" && pkg.mantleCoreSha !== coreSha) {
    throw new Error(`${path}: Core SHA ${pkg.mantleCoreSha ?? "missing"} != ${coreSha}`);
  }
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if ((name === "@aotter/mantle" || name.startsWith("@aotter/mantle-")) && value !== version) {
        throw new Error(`${path}: ${name} ${value} != ${version}`);
      }
    }
  }
}

const workflow = show(".github/workflows/validate.yml");
if (!workflow.includes("Resolve exact released Core SHA") ||
    !workflow.includes("ref: ${{ steps.core.outputs.sha }}")) {
  throw new Error("validate.yml does not resolve the released Core tag to an exact SHA");
}
try {
  execFileSync("git", ["diff", "--quiet", parent, commit, "--", ".github/workflows/validate.yml"]);
} catch {
  throw new Error("release candidate modifies validate.yml outside the gated Starter base");
}

let releasedSha = git("ls-remote", "https://github.com/aotter/mantle.git", `refs/tags/v${version}^{}`)
  .split(/\s+/)[0];
if (!releasedSha) {
  releasedSha = git("ls-remote", "https://github.com/aotter/mantle.git", `refs/tags/v${version}`)
    .split(/\s+/)[0];
}
if (releasedSha !== coreSha) throw new Error(`Core v${version} resolves to ${releasedSha || "nothing"}, not ${coreSha}`);

const actualParent = git("rev-parse", `${commit}^1`);
if (actualParent !== parent) throw new Error(`${commit} parent ${actualParent} != ${parent}`);

console.log(`release candidate ${commit} is valid`);

function show(path) {
  return git("show", `${commit}:${path}`);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

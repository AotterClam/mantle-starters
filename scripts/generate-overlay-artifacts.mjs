#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const check = process.argv.includes("--check");
const archetypes = ["presence", "intake", "publication", "transaction", "reservation", "community"];

for (const archetype of archetypes) {
  const args = [
    "--dir",
    join(root, "blank"),
    "exec",
    "mantle",
    "generate",
    "--manifests",
    join(root, "overlays", archetype, "manifests"),
    "--output",
    join(root, "overlays", archetype, "generated"),
    "--no-skills",
    ...(check ? ["--check"] : []),
  ];
  const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(check ? "overlay generated files: current" : "overlay generated files: refreshed");

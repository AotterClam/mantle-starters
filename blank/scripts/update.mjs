#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeBundle } from "./materialize.mjs";

const STARTERS_REPO = "aotter/mantle-starters";
const DEFAULT_REPORT = ".mantle/update-report.json";
const IGNORE_DIRS = new Set([".git", "node_modules", ".wrangler", ".wrangler-test", "dist"]);
const IGNORE_FILES = new Set([".mantle/features.json", ".mantle/launch-state.json"]);

if (
  process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main().catch((err) => {
    console.error(`mantle:update: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const launchState = readJson(join(root, ".mantle", "launch-state.json"));
  const features = readJson(join(root, ".mantle", "features.json"));
  const targetRef = flags.ref ?? stringField(features.registry, "version");
  if (!targetRef) throw new Error("Pass --ref <starters-ref> or set .mantle/features.json registry.version.");
  const sourceRef = stringField(launchState, "starter_ref");
  if (!sourceRef) throw new Error(".mantle/launch-state.json is missing starter_ref.");
  const archetype = launchArchetype(launchState, features);

  const tempRoot = mkdtempSync(join(tmpdir(), "mantle-update-"));
  try {
    const sourceRoot = join(tempRoot, "source");
    const targetRoot = join(tempRoot, "target");
    mkdirSync(sourceRoot);
    mkdirSync(targetRoot);
    const sourceBundle = await fetchBundle(sourceRef, archetype);
    const targetBundle = sourceRef === targetRef
      ? sourceBundle
      : await fetchBundle(targetRef, archetype);
    materializeBundle(
      sourceRoot,
      sourceBundle,
      placeholders({ launchState, features, targetRef: sourceRef }),
    );
    materializeBundle(
      targetRoot,
      targetBundle,
      placeholders({ launchState, features, targetRef }),
    );
    const upstream = compare(sourceRoot, targetRoot, { includeRemoved: true });
    const local = compare(root, sourceRoot);
    const report = {
      schema_version: 2,
      generated_at: new Date().toISOString(),
      source_ref: sourceRef,
      target_ref: targetRef,
      bundle_version: targetBundle.version ?? null,
      upstream,
      local,
      next_step: "Port reviewed upstream changes only; preserve local code, instance config, and state.",
    };
    const reportPath = resolve(root, flags.report ?? DEFAULT_REPORT);
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`mantle:update report: ${relative(root, reportPath) || reportPath}`);
    console.log(
      `${sourceRef} → ${targetRef}: ${upstream.differing.length} changed, `
      + `${upstream.missing_current.length} added, ${upstream.removed_upstream.length} removed; `
      + `local: ${local.differing.length} modified, ${local.missing_current.length} missing`,
    );
    if (
      flags.strict
      && (
        upstream.differing.length
        || upstream.missing_current.length
        || upstream.removed_upstream.length
        || local.differing.length
        || local.missing_current.length
      )
    ) process.exit(2);
  } finally {
    if (!flags.keepTemp) rmSync(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const flags = { ref: null, report: null, strict: false, keepTemp: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--strict") flags.strict = true;
    else if (arg === "--keep-temp") flags.keepTemp = true;
    else if (arg === "--ref") flags.ref = requiredValue(argv, ++i, arg);
    else if (arg === "--report") flags.report = requiredValue(argv, ++i, arg);
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm mantle:update --ref <starters-ref> [--report ${DEFAULT_REPORT}] [--strict]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return flags;
}

async function fetchBundle(ref, archetype) {
  const url = `https://raw.githubusercontent.com/${STARTERS_REPO}/${ref}/provision-bundles/${encodeURIComponent(archetype)}.json`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const bundle = await res.json();
  if (!bundle || typeof bundle !== "object" || !bundle.files || typeof bundle.files !== "object") {
    throw new Error(`Invalid provision bundle at ${url}`);
  }
  return bundle;
}

function placeholders({ launchState, features, targetRef }) {
  const github = recordField(launchState, "github");
  const repo = recordField(launchState, "repo");
  const siteOwner = recordField(launchState, "site_owner");
  const locales = arrayField(launchState, "locales");
  const owner = optionalStringField(repo, "owner")
    ?? optionalStringField(github, "owner")
    ?? "unknown-owner";
  const projectName = stringField(launchState, "project_name") ?? stringField(repo, "name") ?? "mantle-site";
  const archetype = launchArchetype(launchState, features);
  const siteUrl = stringField(launchState, "site_url") ?? "https://example.com";
  return {
    PROJECT_NAME: projectName,
    ARCHETYPE: archetype,
    BRAND: stringField(launchState, "brand") ?? projectName,
    DESCRIPTION: stringField(launchState, "description") ?? `${projectName} site.`,
    INSTALL_SUMMARY: stringField(launchState, "summary") ?? `Mantle update check for ${projectName}.`,
    LOCALES: JSON.stringify(locales.length ? locales : ["en"]),
    CANONICAL_LOCALE: stringField(launchState, "canonical_locale") ?? locales[0] ?? "en",
    STARTER_REF: targetRef,
    GITHUB_OWNER: owner,
    ADMIN_GITHUB_LOGIN:
      optionalStringField(github, "admin_login")
      ?? optionalStringField(siteOwner, "github_login")
      ?? owner,
    SITE_OWNER_EMAIL: optionalStringField(siteOwner, "email") ?? "",
    AUTH_MODE: stringField(launchState, "authMode") ?? "self-managed",
    SITE_URL: siteUrl,
    AFTER_LAUNCH_SKILL_URL:
      stringField(launchState, "after_launch_skill_url") ??
      afterLaunchSkillUrl({
        repoUrl: `https://github.com/${owner}/${projectName}`,
        siteUrl,
        archetype,
        locale: stringField(launchState, "canonical_locale") ?? locales[0] ?? "en",
        purpose: stringField(launchState, "description") ?? "",
      }),
    INSTALL_TIMESTAMP: new Date().toISOString(),
  };
}

function launchArchetype(launchState, features) {
  const archetype =
    stringField(launchState, "archetype") ??
    stringField(recordField(features, "archetype"), "name") ??
    "blank";
  if (!/^[a-z0-9-]+$/.test(archetype)) throw new Error(`Invalid archetype: ${archetype}`);
  return archetype;
}

function afterLaunchSkillUrl({ repoUrl, siteUrl, archetype, locale, purpose }) {
  const url = new URL("https://mantle.tools/skill/after-launch");
  url.searchParams.set("repo", repoUrl);
  url.searchParams.set("site", siteUrl);
  url.searchParams.set("type", archetype);
  url.searchParams.set("locale", locale);
  if (purpose) url.searchParams.set("purpose", purpose);
  return url.toString();
}

function compare(currentRoot, upstreamRoot, options = {}) {
  const upstreamFiles = listFiles(upstreamRoot);
  const differing = [];
  const missingCurrent = [];
  for (const path of upstreamFiles) {
    const current = join(currentRoot, path);
    const upstream = join(upstreamRoot, path);
    if (!existsSync(current)) {
      missingCurrent.push({ path, upstream_sha256: sha256(upstream) });
      continue;
    }
    const currentSha = sha256(current);
    const upstreamSha = sha256(upstream);
    if (currentSha !== upstreamSha) {
      differing.push({ path, current_sha256: currentSha, upstream_sha256: upstreamSha });
    }
  }
  const removedUpstream = options.includeRemoved
    ? listFiles(currentRoot)
      .filter((path) => !existsSync(join(upstreamRoot, path)))
      .map((path) => ({ path, current_sha256: sha256(join(currentRoot, path)) }))
    : [];
  return {
    counts: {
      differing: differing.length,
      missing_current: missingCurrent.length,
      removed_upstream: removedUpstream.length,
    },
    differing,
    missing_current: missingCurrent,
    removed_upstream: removedUpstream,
  };
}

function listFiles(root, prefix = "") {
  const files = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(root, path));
    else if (entry.isFile() && !IGNORE_FILES.has(path)) files.push(path);
  }
  return files.sort();
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8"));
}

function recordField(value, key) {
  const field = value && typeof value === "object" && !Array.isArray(value) ? value[key] : null;
  return field && typeof field === "object" && !Array.isArray(field) ? field : {};
}

function stringField(value, key) {
  const field = value && typeof value === "object" && !Array.isArray(value) ? value[key] : null;
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function optionalStringField(value, key) {
  const field = value && typeof value === "object" && !Array.isArray(value) ? value[key] : null;
  return typeof field === "string" ? field.trim() : null;
}

function arrayField(value, key) {
  const field = value && typeof value === "object" && !Array.isArray(value) ? value[key] : null;
  return Array.isArray(field) ? field.filter((item) => typeof item === "string") : [];
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export { compare, placeholders };

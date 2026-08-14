#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { materializeBundle } from "./materialize-bundle.mjs";

const root = new URL("..", import.meta.url).pathname;
const archetype = process.argv[2];
const port = valueAfter("--port") ?? process.env.WRANGLER_DEV_PORT ?? "8787";
const prepareOnly = process.argv.includes("--prepare-only");
const output = valueAfter("--out");
const materializeCommand = process.env.npm_lifecycle_event === "materialize";

if (!archetype || archetype.startsWith("-")) {
  fail(materializeCommand
    ? "usage: pnpm materialize <type> --out <dir> [--project-name <slug>] [--brand <name>] [--description <text>] [--locales <en,zh-TW>]"
    : "usage: pnpm dev:bundle <type> [--port 8787] [--prepare-only]");
}
if (materializeCommand && !output) fail("materialize requires --out <dir>");

const bundlePath = join(root, "provision-bundles", `${archetype}.json`);
if (!existsSync(bundlePath)) {
  fail(`missing provision bundle: provision-bundles/${archetype}.json`);
}

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
if (bundle.kind !== "mantle-provision-bundle" || bundle.archetype !== archetype) {
  fail(`invalid provision bundle: provision-bundles/${archetype}.json`);
}
const targetRoot = output
  ? prepareTarget(output)
  : mkdtempSync(join(tmpdir(), `mantle-${archetype}-bundle-`));
const replacements = output
  ? localLaunch(archetype, targetRoot, bundle.version)
  : sampleLaunch(archetype);

materializeBundle(targetRoot, bundle, replacements);

if (output) {
  console.log(`materialized ${archetype} bundle at ${targetRoot}`);
  process.exit(0);
}

const nodeModules = archetype === "blank"
  ? join(root, "blank", "node_modules")
  : join(root, "recipes", "typed-web", "node_modules");
if (existsSync(nodeModules) && !existsSync(join(targetRoot, "node_modules"))) {
  symlinkSync(nodeModules, join(targetRoot, "node_modules"), "dir");
}

console.log(`generated ${archetype} bundle at ${targetRoot}`);
console.log(`local URL: http://localhost:${port}`);

run("pnpm", ["prepare"], targetRoot);
if (!prepareOnly) {
  run("pnpm", [
    "exec",
    "wrangler",
    "dev",
    "--ip",
    "localhost",
    "--port",
    port,
    "--inspector-port",
    process.env.WRANGLER_INSPECTOR_PORT ?? "0",
    "--persist-to",
    ".wrangler",
  ], targetRoot);
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function prepareTarget(path) {
  const target = resolve(path);
  const sourceRoot = resolve(root);
  if (target === sourceRoot || target.startsWith(`${sourceRoot}/`)) {
    fail("output directory must be outside the mantle-starters checkout");
  }
  if (existsSync(target) && readdirSync(target).length > 0) {
    fail(`output directory is not empty: ${target}`);
  }
  mkdirSync(target, { recursive: true });
  return target;
}

function localLaunch(type, targetRoot, version) {
  const projectName = slug(valueAfter("--project-name") ?? basename(targetRoot));
  const brand = safeText(valueAfter("--brand") ?? title(projectName), "brand");
  const description = safeText(
    valueAfter("--description") ?? `${brand} is a ${type} site built with Mantle.`,
    "description",
  );
  const locales = (valueAfter("--locales") ?? "en")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!locales.length) fail("at least one locale is required");
  if (locales.some((locale) => !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale))) {
    fail("locales must use language or language-REGION form, for example en or zh-TW");
  }
  const starterRef = version ? `v${version}` : "local";
  return {
    PROJECT_NAME: projectName,
    ARCHETYPE: type,
    AUTH_MODE: "self-managed",
    BRAND: brand,
    DESCRIPTION: description,
    INSTALL_SUMMARY: description,
    LOCALES: JSON.stringify(locales),
    CANONICAL_LOCALE: locales[0],
    STARTER_REF: starterRef,
    GITHUB_OWNER: "",
    ADMIN_GITHUB_LOGIN: "",
    SITE_OWNER_EMAIL: "",
    SITE_URL: `http://localhost:${port}`,
    AFTER_LAUNCH_SKILL_URL: `https://raw.githubusercontent.com/aotter/mantle/${starterRef}/skills/develop/SKILL.md`,
    INSTALL_TIMESTAMP: new Date().toISOString(),
  };
}

function sampleLaunch(type) {
  const brand = type === "presence" ? "Northstar Studio" : "Mantle Preview";
  const description =
    type === "presence"
      ? "A compact studio helping teams explain their work, collect serious inquiries, and launch a useful web presence quickly."
      : "A Mantle starter preview generated from a provision bundle.";
  return {
    PROJECT_NAME: `${type}-preview`,
    ARCHETYPE: type,
    AUTH_MODE: "self-managed",
    BRAND: brand,
    DESCRIPTION: description,
    INSTALL_SUMMARY: `Local ${type} provision bundle preview.`,
    LOCALES: '["en"]',
    CANONICAL_LOCALE: "en",
    STARTER_REF: "local",
    GITHUB_OWNER: "aotter",
    ADMIN_GITHUB_LOGIN: "aotter",
    SITE_OWNER_EMAIL: "owner@example.com",
    SITE_URL: `http://localhost:${port}`,
    AFTER_LAUNCH_SKILL_URL: "https://mantle.tools/skill/after-launch?id=local",
    INSTALL_TIMESTAMP: new Date(0).toISOString(),
  };
}

function slug(value) {
  const result = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  if (!result) fail("project name must contain a letter or number");
  return result;
}

function title(value) {
  return value.replace(/(^|-)([a-z0-9])/g, (_match, separator, character) =>
    `${separator ? " " : ""}${character.toUpperCase()}`);
}

function safeText(value, label) {
  if (/["\\\r\n{}]/.test(value)) {
    fail(`${label} cannot contain quotes, backslashes, braces, or newlines`);
  }
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} cannot be empty`);
  return trimmed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

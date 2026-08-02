#!/usr/bin/env node
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { materializeBundle } from "./materialize-bundle.mjs";

const root = new URL("..", import.meta.url).pathname;
const archetypes = ["blank", "presence", "intake", "publication", "transaction", "reservation", "community"];
const replacements = {
  PROJECT_NAME: "bundle-smoke",
  ARCHETYPE: "blank",
  AUTH_MODE: "hosted",
  BRAND: 'North & <Star> "Lab"',
  DESCRIPTION: 'A "minimal" Mantle \\ site.',
  INSTALL_SUMMARY: "Generated from the immutable bundle.",
  LOCALES: '["en","zh-TW"]',
  CANONICAL_LOCALE: "en",
  STARTER_REF: "smoke",
  GITHUB_OWNER: "aotter",
  ADMIN_GITHUB_LOGIN: "aotter",
  SITE_OWNER_EMAIL: "owner@example.com",
  SITE_URL: "https://bundle-smoke.example",
  TURNSTILE_SITE_KEY: 'test-site-key<&"',
  AFTER_LAUNCH_SKILL_URL: "https://mantle.tools/skill/after-launch?id=smoke",
  INSTALL_TIMESTAMP: "2026-01-01T00:00:00.000Z",
};

assertHostileLocalesFailClosed();
assertHostilePathFailsClosed();

for (const archetype of archetypes) {
  const bundle = JSON.parse(readFileSync(join(root, "provision-bundles", `${archetype}.json`), "utf8"));
  const first = mkdtempSync(join(tmpdir(), `mantle-${archetype}-first-`));
  const second = mkdtempSync(join(tmpdir(), `mantle-${archetype}-second-`));
  try {
    const values = { ...replacements, ARCHETYPE: archetype };
    materializeBundle(first, bundle, values);
    materializeBundle(second, bundle, values);
    assertNoPlaceholders(first);
    assertDeterministic(first, second);
    assertCommonShape(first, archetype);
    if (archetype === "blank") assertBlank(first);
    else assertWebOverlay(first, archetype);
    if (archetype === "presence" || archetype === "intake") assertTurnstile(first, archetype);
    if (archetype === "transaction") assertTransaction(first);
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
}

console.log("minimal provision bundle smoke passed");

function assertCommonShape(target, archetype) {
  const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
  if (pkg.description !== replacements.DESCRIPTION) fail(archetype, "package description is not valid JSON text");
  if (Object.keys(pkg.dependencies ?? {}).join(",") !== "@aotter/mantle") {
    fail(archetype, "production dependencies must contain only @aotter/mantle");
  }
  const developmentDependencies = Object.keys(pkg.devDependencies ?? {}).sort();
  if (developmentDependencies.join(",") !== "@types/node,typescript,wrangler") {
    fail(archetype, `unexpected development dependencies: ${developmentDependencies.join(",")}`);
  }
  const config = JSON.parse(readFileSync(join(target, "wrangler.jsonc"), "utf8"));
  if (config.name !== replacements.PROJECT_NAME) fail(archetype, "Worker name was not materialized");
  if (config.cache?.enabled !== true) fail(archetype, "top-level Workers cache is not enabled");
  if (config.vars?.PUBLIC_ORIGIN !== replacements.SITE_URL) fail(archetype, "site URL var is stale");
  if (JSON.stringify(config.vars?.MANTLE_SITE_LOCALES) !== replacements.LOCALES) {
    fail(archetype, "locale vars were not materialized as JSON");
  }
  const envTypes = readFileSync(join(target, ".mantle/generated/env.d.ts"), "utf8");
  for (const binding of ["DB: D1Database", "KV: KVNamespace", "OAUTH_KV: KVNamespace"]) {
    if (!envTypes.includes(binding)) fail(archetype, `generated Env missing ${binding}`);
  }
  const generated = readFileSync(join(target, ".mantle/generated/site.ts"), "utf8");
  if (generated.includes("parseManifests") || generated.includes(".yaml")) {
    fail(archetype, "generated Worker module still parses YAML at runtime");
  }
}

function assertBlank(target) {
  const files = listFiles(target);
  for (const forbidden of ["src/home.ts", "components/", "kiwa/", "styles/", "scripts/"]) {
    if (files.some((file) => file === forbidden || file.startsWith(forbidden))) {
      fail("blank", `contains ${forbidden}`);
    }
  }
  const entry = readFileSync(join(target, "src/index.ts"), "utf8");
  if (!entry.includes("createMantleWorker({ manifest })")) fail("blank", "does not use the default façade");
  if (entry.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//")).length > 4) {
    fail("blank", "Worker entry exceeds the attention budget");
  }
  const counted = files.filter((file) =>
    file !== "pnpm-lock.yaml" &&
    !file.startsWith(".mantle/generated/") &&
    !/^\.(agent|claude)\/skills\/mantle-[^/]+\/SKILL\.md$/.test(file)
  );
  if (counted.length > 20) fail("blank", `has ${counted.length} counted files (max 20)`);
  const launchMetadata = new Set([
    ".mantle/features.json",
    ".mantle/handoff.md",
    ".mantle/launch-state.json",
  ]);
  const authoredSupport = counted.filter((file) => !launchMetadata.has(file));
  if (authoredSupport.length > 12) {
    fail("blank", `has ${authoredSupport.length} authored/support files (max 12)`);
  }
  const projectedSkills = files.filter((file) =>
    /^\.(agent|claude)\/skills\/mantle-[^/]+\/SKILL\.md$/.test(file)
  );
  console.log(
    `blank file budget: ${counted.length} counted, ${authoredSupport.length} authored/support, `
    + `${projectedSkills.length} projected skills, ${files.length} total`,
  );
}

function assertWebOverlay(target, archetype) {
  const home = readFileSync(join(target, "public/index.html"), "utf8");
  if (!home.includes(`content=\"${archetype}\"`)) fail(archetype, "static homepage has the wrong archetype");
  if (!home.includes("North &amp; &lt;Star&gt; &quot;Lab&quot;") || home.includes("North & <Star>")) {
    fail(archetype, "static homepage does not escape provisioned text");
  }
  const escapedBrand = "North &amp; &lt;Star&gt; &quot;Lab&quot;";
  const escapedDescription = "A &quot;minimal&quot; Mantle \\ site.";
  for (const expected of [
    `<title>${escapedBrand}</title>`,
    `<meta name="description" content="${escapedDescription}">`,
    `<header><a class="brand" href="/">${escapedBrand}</a>`,
    `<footer><strong>${escapedBrand}</strong><p>`,
    `<small>Copyright ${escapedBrand}.</small>`,
  ]) {
    if (!home.includes(expected)) fail(archetype, `static page chrome is missing ${expected}`);
  }
  if (home.includes("<p></p>") || home.includes("<small></small>")) {
    fail(archetype, "static page contains empty footer chrome");
  }
  const launch = JSON.parse(readFileSync(join(target, ".mantle/launch-state.json"), "utf8"));
  if (launch.brand !== replacements.BRAND || launch.description !== replacements.DESCRIPTION) {
    fail(archetype, "launch-state JSON did not preserve provisioned text");
  }
  const entry = readFileSync(join(target, "src/index.ts"), "utf8");
  if (!entry.includes("createMantleWorker") || entry.includes("mountHome")) {
    fail(archetype, "does not use the minimal Mantle Worker entry");
  }
  const config = JSON.parse(readFileSync(join(target, "wrangler.jsonc"), "utf8"));
  if (config.assets?.directory !== "./public") fail(archetype, "does not use Cloudflare static assets");
  if (!home.includes("<form") && (
    home.includes("fetch(form.action)")
    || home.includes("challenges.cloudflare.com/turnstile")
  )) {
    fail(archetype, "form-free page ships dead form or Turnstile client code");
  }
  if ((home.match(/<h1(?:\s|>)/g) ?? []).length !== 1) {
    fail(archetype, "page must contain exactly one primary heading");
  }
  if (home.includes("<h3></h3>")) fail(archetype, "page contains an empty card heading");
}

function assertHostileLocalesFailClosed() {
  const target = mkdtempSync(join(tmpdir(), "mantle-hostile-locales-"));
  const bundle = JSON.parse(readFileSync(join(root, "provision-bundles", "blank.json"), "utf8"));
  try {
    try {
      materializeBundle(target, bundle, {
        ...replacements,
        LOCALES: '[],"INJECTED":true',
      });
      throw new Error("hostile LOCALES input was accepted");
    } catch (error) {
      if (!String(error).includes("LOCALES must be")) throw error;
    }
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

function assertHostilePathFailsClosed() {
  const target = mkdtempSync(join(tmpdir(), "mantle-hostile-path-"));
  try {
    try {
      materializeBundle(target, { files: { "../outside": "bad" } }, replacements);
      throw new Error("escaping bundle path was accepted");
    } catch (error) {
      if (!String(error).includes("bundle path escapes project root")) throw error;
    }
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
}

function assertTransaction(target) {
  const manifest = readFileSync(join(target, "manifests/transaction.yaml"), "utf8");
  for (const expected of [
    "name: products",
    "name: product-inquiries",
    "name: public-products",
    "name: submit-product-inquiry",
    "path: /api/product-inquiries",
  ]) {
    if (!manifest.includes(expected)) fail("transaction", `manifest missing ${expected}`);
  }
  if (listFiles(target).some((file) => file.includes("handlers"))) {
    fail("transaction", "builtin-only transaction generated a handler registry");
  }
  if (!manifest.includes('pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"')) {
    fail("transaction", "product slugs permit empty or repeated dash segments");
  }
}

function assertTurnstile(target, archetype) {
  const home = readFileSync(join(target, "public/index.html"), "utf8");
  if (!home.includes('data-sitekey="test-site-key&lt;&amp;&quot;"')) {
    fail(archetype, "Turnstile public key was not safely materialized into the page");
  }
  if (!home.includes("challenges.cloudflare.com/turnstile/v0/api.js")) {
    fail(archetype, "Turnstile client script is missing");
  }
  if (!home.includes("turnstile.reset()") || home.includes("turnstile.reset(widget)")) {
    fail(archetype, "Turnstile retry must reset the implicit widget without an invalid element argument");
  }
}

function assertNoPlaceholders(target) {
  for (const file of listFiles(target)) {
    const text = readFileSync(join(target, file), "utf8");
    if (/\{\{[A-Z_][A-Z0-9_]*\}\}/.test(text)) throw new Error(`unfilled placeholder in ${file}`);
  }
}

function assertDeterministic(first, second) {
  const firstFiles = listFiles(first);
  const secondFiles = listFiles(second);
  if (JSON.stringify(firstFiles) !== JSON.stringify(secondFiles)) throw new Error("materialized file trees differ");
  for (const file of firstFiles) {
    if (readFileSync(join(first, file), "utf8") !== readFileSync(join(second, file), "utf8")) {
      throw new Error(`materialization is not deterministic: ${file}`);
    }
  }
}

function listFiles(target) {
  const files = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(target, path));
    }
  };
  walk(target);
  return files.sort();
}

function fail(archetype, message) {
  throw new Error(`${archetype}: ${message}`);
}

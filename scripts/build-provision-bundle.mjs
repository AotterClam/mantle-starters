#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { parse as parseYaml, parseAllDocuments, stringify as stringifyYaml } from "yaml";

const root = new URL("..", import.meta.url).pathname;
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const checkOnly = process.argv.includes("--check");
const archetypes = ["blank", "presence", "intake", "publication", "transaction", "reservation", "community"];
const dependencySectionKeys = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

for (const archetype of archetypes) {
  const files = buildBundleFiles(archetype);
  const localizedFiles = findLocalizedFiles(files, archetype);
  const outPath = join(root, "provision-bundles", `${archetype}.json`);
  const bundleText = JSON.stringify({
    version,
    kind: "mantle-provision-bundle",
    formatVersion: 1,
    archetype,
    ...(localizedFiles.length > 0 ? { localizedFiles } : {}),
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  }, null, 2) + "\n";

  if (checkOnly) {
    const current = readFileSync(outPath, "utf8");
    if (current !== bundleText) {
      console.error(`provision-bundles/${archetype}.json is stale; run pnpm build:provision-bundle`);
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, bundleText);
  }

  assertBundle(JSON.parse(bundleText), archetype);
}

function buildBundleFiles(archetype) {
  const files = {};
  walk(files, "blank", "");
  if (archetype !== "blank") {
    walk(files, "recipes/typed-web", "");
    delete files["manifests/site.yaml"];
  }
  resolveCatalogPackageJson(files);
  applyProvisionedPackageMetadata(files);
  resolveCatalogLockfile(files);
  if (archetype !== "blank") {
    applyOverlay(files, archetype);
    selectTypedSurface(files, archetype);
    pruneRuntimeSource(files);
  }
  files["wrangler.toml"] = files["wrangler.toml"]
    .replace(/^name = ".*"$/m, 'name = "{{PROJECT_NAME}}"')
    .replace(/^database_name = ".*"$/m, 'database_name = "{{PROJECT_NAME}}-db"');
  for (const path of Object.keys(files)) {
    if (isGeneratedOutput(path)) delete files[path];
  }

  files[".mantle/launch-state.json.template"] = [
    "{",
    '  "schema_version": 2,',
    '  "project_name": "{{PROJECT_NAME}}",',
    '  "archetype": "{{ARCHETYPE}}",',
    '  "brand": "{{BRAND}}",',
    '  "purpose": "{{DESCRIPTION}}",',
    '  "description": "{{DESCRIPTION}}",',
    '  "summary": "{{INSTALL_SUMMARY}}",',
    '  "authMode": "{{AUTH_MODE}}",',
    '  "site_url": "{{SITE_URL}}",',
    '  "after_launch_skill_url": "{{AFTER_LAUNCH_SKILL_URL}}",',
    '  "locales": {{LOCALES}},',
    '  "canonical_locale": "{{CANONICAL_LOCALE}}",',
    '  "theme": null,',
    '  "features": [],',
    '  "starter_ref": "{{STARTER_REF}}",',
    '  "github": {',
    '    "owner": "{{GITHUB_OWNER}}",',
    '    "admin_login": "{{ADMIN_GITHUB_LOGIN}}"',
    "  },",
    '  "repo": {',
    '    "owner": "{{GITHUB_OWNER}}",',
    '    "name": "{{PROJECT_NAME}}",',
    '    "visibility": "private",',
    '    "defaultBranch": "main"',
    "  },",
    '  "handoff": ".mantle/handoff.md",',
    '  "overlay": {',
    '    "suggested": "{{ARCHETYPE}}",',
    `    "path": ${archetype === "blank" ? "null" : '".mantle/overlays/{{ARCHETYPE}}"'}`,
    "  }",
    "}",
    "",
  ].join("\n");

  files[".mantle/features.json.template"] = JSON.stringify({
    registry: {
      name: "mantle-starters",
      url: "https://mantle.tools/registry.json",
      version: "{{STARTER_REF}}",
    },
    archetype: {
      name: "{{ARCHETYPE}}",
      type: "registry:archetype",
      overlayPath: archetype === "blank" ? null : ".mantle/overlays/{{ARCHETYPE}}",
      appliedAt: archetype === "blank" ? null : "{{INSTALL_TIMESTAMP}}",
    },
    theme: null,
    features: [],
    resolvedAt: "{{INSTALL_TIMESTAMP}}",
  }, null, 2) + "\n";

  files[".mantle/handoff.md.template"] = [
    "# Mantle launch handoff",
    "",
    "This project was materialized from a deterministic Mantle provision bundle.",
    "",
    "- Project: {{PROJECT_NAME}}",
    "- Site: {{SITE_URL}}",
    "- Type intent: {{ARCHETYPE}}",
    "- Auth intent: {{AUTH_MODE}}",
    "- Purpose: {{DESCRIPTION}}",
    "- Full after-launch skill: {{AFTER_LAUNCH_SKILL_URL}}",
    "",
    "The public homepage is for visitors. The coding-agent handoff lives in this repo file.",
    "",
    "Next: inspect the manifest/pages/seed, then offer three paths tailored to the purpose: shape the visual experience, build the first real business workflow, or finish deploy/auth if incomplete. Do not present auth or seed data as the only next step.",
    "",
  ].join("\n");
  applyProvisionedReadme(files, archetype);
  return files;
}

function findLocalizedFiles(files, archetype) {
  const prefix = `.mantle/overlays/${archetype}/`;
  return Object.keys(files).filter((path) => {
    if (!path.startsWith(prefix) || !path.endsWith(".json")) return false;
    const locales = JSON.parse(files[path])?.locales;
    if (!locales || typeof locales !== "object" || Array.isArray(locales)) return false;
    const entries = Object.entries(locales);
    if (entries.length === 0) throw new Error(`${path} must define at least one locale`);
    const keys = JSON.stringify(Object.keys(entries[0][1] ?? {}).sort());
    for (const [locale, value] of entries) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${path} locale ${locale} must be an object`);
      }
      if (JSON.stringify(Object.keys(value).sort()) !== keys) {
        throw new Error(`${path} locale ${locale} has a different key set`);
      }
    }
    return true;
  }).sort();
}

function isGeneratedOutput(path) {
  return path.startsWith(".mantle/generated/")
    || path.startsWith("public/_mantle/")
    || [
      "public/assets/styles.css",
      "public/assets/kiwa-home.js",
      "public/assets/mantle-ocean-hero-light.svg",
      "public/assets/mantle-ocean-hero-dark.svg",
    ].includes(path)
    || /^public\/enhance\/[^/]+\.js$/.test(path);
}

function assertBundle(bundle, archetype) {
  if (bundle.formatVersion !== 1) {
    throw new Error(`${archetype} bundle must declare formatVersion 1`);
  }
  for (const required of [
    "package.json",
    ".gitignore",
    "wrangler.toml",
    ".dev.vars.example",
    ".mantle/launch-state.json.template",
    ".mantle/features.json.template",
    ".mantle/handoff.md.template",
    ".agents/skills/mantle-develop/SKILL.md",
    ".agents/skills/mantle-plugin/SKILL.md",
    ".agents/skills/mantle-theme/SKILL.md",
    ".agents/skills/mantle-update/SKILL.md",
    ".claude/skills/mantle-develop/SKILL.md",
    ".claude/skills/mantle-plugin/SKILL.md",
    ".claude/skills/mantle-theme/SKILL.md",
    ".claude/skills/mantle-update/SKILL.md",
    "public/site-icon.svg",
  ]) {
    if (!bundle.files[required]) throw new Error(`${archetype} bundle missing ${required}`);
  }
  if (!bundle.files["pnpm-workspace.yaml"]?.includes('  - "."')) {
    throw new Error(`${archetype} bundle missing root package workspace entry`);
  }
  if (!bundle.files["wrangler.toml"]?.includes("https://auth.mantle.tools")) {
    throw new Error(`${archetype} bundle must use the canonical Hosted Auth issuer`);
  }
  if (!bundle.files["wrangler.toml"]?.includes('MANTLE_AUTH_MODE = "{{AUTH_MODE}}"')) {
    throw new Error(`${archetype} bundle must declare the explicit auth mode`);
  }
  if (!bundle.files["wrangler.toml"]?.includes('name = "{{PROJECT_NAME}}"')
      || !bundle.files["wrangler.toml"]?.includes('database_name = "{{PROJECT_NAME}}-db"')) {
    throw new Error(`${archetype} bundle must template its Wrangler project identity`);
  }
  if (!bundle.files["wrangler.toml"]?.includes('[assets]\ndirectory = "./public"\nbinding = "ASSETS"')) {
    throw new Error(`${archetype} bundle must use Cloudflare Static Assets`);
  }
  const worker = archetype === "blank" ? bundle.files["src/index.ts"] : bundle.files["src/mantle/worker.ts"];
  if (bundle.files["src/auth.ts"] || worker?.includes("auth: buildAuth")) {
    throw new Error(`${archetype} bundle must use Core conventional Auth`);
  }
  if (bundle.files["wrangler.toml"]?.includes("MANTLE_PLATFORM_AUTH")) {
    throw new Error(`${archetype} bundle still contains preview Hosted Auth variables`);
  }
  if (!bundle.files["manifests/site.yaml"]) {
    throw new Error(`${archetype} bundle missing applied manifest`);
  }
  const manifest = JSON.parse(bundle.files["package.json"]);
  if (manifest.engines?.node !== ">=22.13") {
    throw new Error(`${archetype} bundle must require Node >=22.13 for unflagged node:sqlite`);
  }
  if (manifest.scripts?.build !== "pnpm check") {
    throw new Error(`${archetype} bundle build must run the complete check lifecycle`);
  }
  if (!manifest.scripts?.typecheck?.startsWith("pnpm generate && ")) {
    throw new Error(`${archetype} bundle typecheck must work without committed generated files`);
  }
  const expectedPrepare = archetype === "blank" ? "pnpm generate" : "pnpm generate && pnpm build:styles";
  if (manifest.scripts?.prepare !== expectedPrepare) {
    throw new Error(`${archetype} bundle prepare must materialize generated outputs`);
  }
  if (Object.keys(bundle.files).some(isGeneratedOutput)) {
    throw new Error(`${archetype} bundle includes generated output`);
  }
  const ignores = new Set(bundle.files[".gitignore"].split(/\r?\n/));
  for (const output of [
    ".mantle/generated/",
    "public/_mantle/",
    "public/assets/styles.css",
    "public/assets/kiwa-home.js",
    "public/assets/mantle-ocean-hero-light.svg",
    "public/assets/mantle-ocean-hero-dark.svg",
    "public/enhance/*.js",
  ]) {
    if (!ignores.has(output)) throw new Error(`${archetype} bundle must ignore ${output}`);
  }
  for (const path of bundle.localizedFiles ?? []) {
    if (!bundle.files[path]) throw new Error(`${archetype} localized file is absent from bundle: ${path}`);
    const locales = JSON.parse(bundle.files[path])?.locales;
    if (!locales || typeof locales !== "object" || Array.isArray(locales)) {
      throw new Error(`${archetype} localized file must expose an object at locales: ${path}`);
    }
  }
  if (archetype === "blank") {
    assertHeadlessBlank(bundle);
  }
  if (archetype !== "blank") {
    for (const required of [
      "src/web/content/types.ts",
      "scripts/build-styles.mjs",
      "styles/globals.css",
      "public/site-icon.svg",
    ]) {
      if (!bundle.files[required]) throw new Error(`${archetype} bundle missing ${required}`);
    }
    if (bundle.files["src/worker/routes/assets.ts"] || bundle.files["src/web/assets.ts"]) {
      throw new Error(`${archetype} bundle still contains Worker-served asset plumbing`);
    }
    const seedImport = `../../.mantle/overlays/${archetype}/seed.json`;
    if (!bundle.files["src/mantle/seed.ts"]?.includes(seedImport)) {
      throw new Error(`${archetype} initial seed must read the overlay seed`);
    }
    if (!bundle.files["src/mantle/worker.ts"]?.includes("createMantleWorker") ||
        !bundle.files["src/mantle/worker.ts"]?.includes(".mantle/generated/mantle.js")) {
      throw new Error(`${archetype} Worker must use Core's facade and generated RuntimePlan`);
    }
    for (const path of Object.keys(bundle.files)) {
      if (!["src/", "components/", "lib/", "styles/"].some((prefix) => path.startsWith(prefix))) continue;
      for (const specifier of imports(bundle.files[path])) {
        const target = resolveLocalImport(bundle.files, path, specifier);
        if (target?.startsWith("kiwa/") || specifier === "kiwa" || specifier.startsWith("kiwa/")) {
          throw new Error(`${archetype} runtime source imports the offline Kiwa palette: ${path}`);
        }
      }
    }
    if (Object.keys(bundle.files).some((path) => path.startsWith("kiwa/"))) {
      throw new Error(`${archetype} bundle includes the offline Kiwa palette`);
    }
  }
  assertLockfileMatchesPackageJson(bundle, archetype);
  assertProvisionedReadme(bundle, archetype);
}

function assertHeadlessBlank(bundle) {
  for (const required of [
    "manifests/site.yaml",
    "src/index.ts",
  ]) {
    if (!bundle.files[required]) throw new Error(`blank bundle missing ${required}`);
  }
  for (const path of Object.keys(bundle.files)) {
    if (["components/", "kiwa/", "lib/", "scripts/", "src/mantle/", "src/web/", "src/worker/", "styles/"]
      .some((prefix) => path.startsWith(prefix))) {
      throw new Error(`blank bundle includes typed/UI source: ${path}`);
    }
  }
  const manifest = JSON.parse(bundle.files["package.json"]);
  // Core, the Cloudflare adapter, and the adapter's four required peers.
  // The peers are not optional, so leaving them undeclared made the install
  // depend on pnpm's auto-install-peers default and hid a stale `better-auth`
  // pin from the lock refresh's range check. Declared peers keep blank
  // headless while making its manifest complete.
  if (JSON.stringify(Object.keys(manifest.dependencies ?? {}))
    !== '["@aotter/mantle","@aotter/mantle-cloudflare","aws4fetch","better-auth","hono","zod"]') {
    throw new Error("blank production dependencies must be Mantle Core, Cloudflare, and the adapter peers");
  }
  const worker = bundle.files["src/index.ts"];
  if (!worker.includes("createMantleWorker") || !worker.includes(".mantle/generated/mantle.js")) {
    throw new Error("blank Worker must use the generated RuntimePlan and Core facade");
  }
  if (bundle.files["wrangler.toml"].includes("[[rules]]")) {
    throw new Error("blank must not ship runtime YAML/CSS loader rules");
  }
}

function applyProvisionedReadme(files, archetype) {
  const base = files["README.md"];
  if (!base) return;
  if (archetype === "blank") return;
  const reusableStart = base.indexOf("## Kiwa UI Credit");
  const reusableBody = reusableStart === -1 ? base : base.slice(reusableStart);
  const manifestPath = "manifests/site.yaml";
  const overview = [
    "# {{BRAND}}",
    "",
    "{{DESCRIPTION}}",
    "",
    "## Launch overview",
    "",
    "This repository was materialized from a deterministic Mantle provision bundle.",
    "",
    `- Launch type: \`{{ARCHETYPE}}\``,
    "- Site: {{SITE_URL}}",
    `- Manifest: \`${manifestPath}\``,
    "- Launch facts: `.mantle/launch-state.json`",
    "- Agent handoff: `.mantle/handoff.md`",
    `- Type notes: \`.mantle/overlays/${archetype}/handoff.md\``,
    `- Layout notes: \`.mantle/overlays/${archetype}/layout.md\``,
    `- Seed data: \`.mantle/overlays/${archetype}/seed.json\``,
    "",
    "## Type notes",
    "",
    stripMarkdownTitle(files[`.mantle/overlays/${archetype}/handoff.md`] ?? ""),
    "",
    "## Layout notes",
    "",
    stripMarkdownTitle(files[`.mantle/overlays/${archetype}/layout.md`] ?? ""),
    "",
  ].join("\n");
  files["README.md"] = `${overview}\n${reusableBody}`;
}

function stripMarkdownTitle(text) {
  return text.replace(/^# .*\n+/, "").trim();
}

function assertProvisionedReadme(bundle, archetype) {
  const readme = bundle.files["README.md"] ?? "";
  if (!readme.startsWith("# {{BRAND}}\n")) {
    throw new Error(`${archetype} README must start with the provisioned brand placeholder`);
  }
  if (archetype === "blank") {
    for (const required of [
      "manifests/site.yaml",
      ".mantle/handoff.md",
      ".mantle/launch-state.json",
      "createMantleWorker",
    ]) {
      if (!readme.includes(required)) throw new Error(`blank README missing ${required}`);
    }
    if (readme.includes("## Kiwa UI Credit")) throw new Error("blank README claims a Kiwa UI surface");
    return;
  }
  for (const required of ["## Launch overview", "## Type notes", ".mantle/handoff.md", ".mantle/launch-state.json"]) {
    if (!readme.includes(required)) throw new Error(`${archetype} README missing ${required}`);
  }
  if (readme.includes("aotter/mantle-starters/blank")) {
    throw new Error(`${archetype} README still reads like the source starter README`);
  }
  const manifestPath = "manifests/site.yaml";
  if (!readme.includes(manifestPath)) throw new Error(`${archetype} README missing manifest path`);
  if (archetype !== "blank") {
    for (const required of [
      `.mantle/overlays/${archetype}/handoff.md`,
      `.mantle/overlays/${archetype}/layout.md`,
      `.mantle/overlays/${archetype}/seed.json`,
      "## Layout notes",
    ]) {
      if (!readme.includes(required)) throw new Error(`${archetype} README missing ${required}`);
    }
  }
}

function walk(files, from, to) {
  for (const name of readdirSync(join(root, from))) {
    if (skip(name)) continue;
    const source = join(root, from, name);
    const target = posix.join(to, name).replace(/\.template$/, "");
    const stat = statSync(source);
    if (stat.isDirectory()) {
      walk(files, posix.join(from, name), target);
    } else if (stat.isFile()) {
      files[target] = readFileSync(source, "utf8");
    }
  }
}

function applyOverlay(files, archetype) {
  walk(files, `overlays/${archetype}/manifests`, "manifests");
  const wranglerAppend = join(root, "overlays", archetype, "wrangler.append.toml");
  if (existsSync(wranglerAppend)) {
    files["wrangler.toml"] = `${files["wrangler.toml"].trimEnd()}\n${readFileSync(wranglerAppend, "utf8")}`;
  }
  let seedText = null;
  for (const name of ["handoff.md", "layout.md", "seed-prompt.md", "seed.json", "messages.json"]) {
    const path = join(root, "overlays", archetype, name);
    try {
      if (statSync(path).isFile()) {
        const text = readFileSync(path, "utf8");
        files[`.mantle/overlays/${archetype}/${name}`] = text;
        if (name === "seed.json") seedText = text;
      }
    } catch {
      // optional
    }
  }
  if (seedText) applyOverlaySeedContent(files, archetype, seedText);
  walkIfExists(files, `overlays/${archetype}/src`, "src");
}

function applyOverlaySeedContent(files, archetype, seedText) {
  const seed = JSON.parse(seedText);
  const seedRuntimeImport = `../../.mantle/overlays/${archetype}/seed.json`;
  files["src/mantle/seed.ts"] = [
    `import seed from "${seedRuntimeImport}";`,
    'import type { MantleRuntime } from "@aotter/mantle/runtime";',
    'import { createInitialSeedRuntime } from "./initialSeed.js";',
    "",
    "export function createSeededRuntime<Env extends { readonly DB: D1Database }>(",
    "  getRuntime: (env: Env) => Promise<MantleRuntime>,",
    "): (env: Env) => Promise<MantleRuntime> {",
    "  return createInitialSeedRuntime(seed, getRuntime);",
    "}",
    "",
  ].join("\n");
  if (seed?.locales) return;
  if (!seed?.site) throw new Error(`${archetype} seed must define site chrome`);
  assertLocalizedChrome(seed, archetype);
  const seedContentImport = `../../../.mantle/overlays/${archetype}/seed.json`;
  files["src/web/content/siteContent.ts"] = [
    `import seed from "${seedContentImport}";`,
    'import type { SiteContent } from "./types.js";',
    "",
    "type Seed = { readonly site: SiteContent };",
    "const seedData = seed as Seed;",
    "export const siteContent: SiteContent = seedData.site;",
    "export function siteContentForLocale(_locale: string): SiteContent { return siteContent; }",
    "",
  ].join("\n");
  if (!Array.isArray(seed?.collections?.page)) {
    throw new Error(`${archetype} seed must define collections.page`);
  }
  files["src/web/content/homeContent.ts"] = [
    'import { DiagnosticError } from "@aotter/mantle/spec";',
    'import type { MantleRuntime } from "@aotter/mantle/runtime";',
    'import { bindMantle } from "../../../.mantle/generated/mantle.js";',
    'import type { HomeContent, HomeSection } from "./types.js";',
    "",
    "export async function resolveHomeContent(getRuntime: () => Promise<MantleRuntime>, _locale?: string): Promise<HomeContent> {",
    "  const result = await bindMantle(await getRuntime()).views.home();",
    "  if (!result.ok) throw new DiagnosticError(result.diagnostic);",
    "  const sections = result.result.rows[0]?.sections as readonly HomeSection[] | undefined;",
    "  return { sections: sections ?? [] };",
    "}",
    "",
  ].join("\n");
}

function assertLocalizedChrome(seed, archetype) {
  for (const key of ["openNavigation", "closeNavigation", "navigation", "toggleTheme", "lightMode", "darkMode"]) {
    if (!seed.site.chromeLabels?.[key]) throw new Error(`${archetype} seed site.chromeLabels.${key} is required`);
  }
  for (const section of (seed.collections?.page ?? []).flatMap((page) => page.sections ?? [])) {
    if (["form", "intake"].includes(section.type)) {
      for (const key of ["pending", "success", "error"]) {
        if (!section.formMessages?.[key]) throw new Error(`${archetype} ${section.type}.formMessages.${key} is required`);
      }
    }
    if (section.type === "intake") {
      for (const key of ["back", "next", "submit", "progressTemplate"]) {
        if (!section.intakeLabels?.[key]) throw new Error(`${archetype} intake.intakeLabels.${key} is required`);
      }
    }
  }
}

function walkIfExists(files, from, to) {
  try {
    statSync(join(root, from));
  } catch {
    return;
  }
  walk(files, from, to);
}

function selectTypedSurface(files, archetype) {
  const selected = selectedSectionNames(files, archetype);
  files["src/web/sections/sectionRegistry.ts"] = [
    ...selected.map((name) => `import { render${upperFirst(name)} } from "./renderers/${name}.js";`),
    'import type { HomeSection } from "../content/types.js";',
    'import type { SectionRenderer } from "./renderSection.js";',
    "",
    "export const sectionRenderers: Partial<Record<HomeSection[\"type\"], SectionRenderer>> = {",
    ...selected.map((name) => `  ${name}: render${upperFirst(name)},`),
    "};",
    "",
  ].join("\n");

  const clients = [
    ...(selected.includes("faq") ? ["enhance"] : []),
    "theme",
    "nav",
    ...(selected.includes("intake") ? ["intake"] : []),
    ...(selected.includes("form") || selected.includes("intake") ? ["form"] : []),
    ...(archetype === "transaction" ? ["commerce"] : []),
  ];
  files["src/web/client/homeClient.ts"] = [
    ...clients.map((name) => `import { ${name}ClientJs } from "./${name}Client.js";`),
    "",
    "export const homeClientJs = [",
    ...clients.map((name) => `  ...${name}ClientJs,`),
    '  "",',
    '].join("\\n");',
    "",
  ].join("\n");

}

function selectedSectionNames(files, archetype) {
  const seed = JSON.parse(files[`.mantle/overlays/${archetype}/seed.json`] ?? "{}");
  const pageCollection = seed.locales
    ? Object.values(seed.locales).flatMap((pack) => pack?.["page-translations"] ?? [])
    : seed.collections?.["page-translations"] ?? seed.collections?.page ?? [];
  const seeded = [...new Set(pageCollection
    .flatMap((page) => page.sections ?? [])
    .map((section) => section.type)
    .filter(Boolean))];
  const schemas = parseAllDocuments(files["manifests/site.yaml"] ?? "")
    .map((document) => document.toJSON())
    .filter((atom) => atom?.kind === "Schema");
  const pageSchema = schemas.find((atom) => atom?.metadata?.name === "page-translations")
    ?? schemas.find((atom) => atom?.metadata?.name === "page");
  if (!pageSchema) throw new Error(`${archetype} manifest must declare the seeded page Schema`);
  const declared = pageSchema?.spec?.schema?.properties?.sections?.items?.properties?.type?.enum;
  if (!Array.isArray(declared)) return seeded;
  for (const type of seeded) {
    if (!declared.includes(type)) throw new Error(`${archetype} seed section ${type} is absent from the page Schema grammar`);
  }
  return declared;
}

function upperFirst(value) {
  return value[0].toUpperCase() + value.slice(1);
}

function pruneRuntimeSource(files) {
  const reachable = new Set();
  const pending = ["src/index.ts", "src/web/client/homeClient.ts", "src/web/mantleOceanHero.ts"];
  if (files["src/web/client/homeClient.ts"]?.includes("enhanceClientJs")) {
    pending.push("src/web/client/kiwaEnhanceAssets.ts");
  }
  while (pending.length > 0) {
    const path = pending.pop();
    if (!path || reachable.has(path) || !files[path]) continue;
    reachable.add(path);
    for (const specifier of imports(files[path])) {
      const resolved = resolveLocalImport(files, path, specifier);
      if (resolved && !reachable.has(resolved)) pending.push(resolved);
    }
  }
  for (const path of Object.keys(files)) {
    if (["src/", "components/", "lib/"].some((prefix) => path.startsWith(prefix)) &&
        !path.endsWith(".d.ts") && !reachable.has(path)) {
      delete files[path];
    }
  }
}

function imports(source) {
  return [
    ...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g),
    ...source.matchAll(/import\s*\(\s*["']([^"']+)["']/g),
    ...source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g),
  ].map((match) => match[1]);
}

function resolveLocalImport(files, importer, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(importer), specifier));
  else return null;
  const withoutJs = base.replace(/\.js$/, "");
  for (const candidate of [base, withoutJs, `${withoutJs}.ts`, `${withoutJs}.tsx`, `${withoutJs}.json`, `${withoutJs}.css`, `${withoutJs}/index.ts`, `${withoutJs}/index.tsx`]) {
    if (files[candidate]) return candidate;
  }
  return null;
}

function listFiles(from, prefix = "") {
  const found = [];
  for (const name of readdirSync(join(root, from))) {
    if (skip(name)) continue;
    const source = join(root, from, name);
    const relative = posix.join(prefix, name);
    const stat = statSync(source);
    if (stat.isDirectory()) found.push(...listFiles(posix.join(from, name), relative));
    else if (stat.isFile()) found.push(relative);
  }
  return found;
}

function skip(name) {
  return [
    ".git",
    ".DS_Store",
    ".dry-build",
    ".wrangler",
    ".wrangler-test",
    ".pnpm-store",
    "node_modules",
    "dist",
  ].includes(name);
}

function resolveCatalogPackageJson(files) {
  const raw = files["package.json"];
  if (!raw) return;
  const catalog = parseYaml(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"))?.catalog ?? {};
  const manifest = JSON.parse(raw);
  for (const key of dependencySectionKeys) {
    const deps = manifest[key];
    if (!deps || typeof deps !== "object" || Array.isArray(deps)) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (spec === "catalog:") deps[name] = catalog[name] ?? fail(`catalog missing ${name}`);
    }
  }
  files["package.json"] = JSON.stringify(manifest, null, 2) + "\n";
}

function applyProvisionedPackageMetadata(files) {
  const manifest = JSON.parse(files["package.json"]);
  manifest.name = "{{PROJECT_NAME}}";
  manifest.description = "{{DESCRIPTION}}";
  files["package.json"] = JSON.stringify(manifest, null, 2) + "\n";
}

function resolveCatalogLockfile(files) {
  const raw = files["pnpm-lock.yaml"];
  const manifestRaw = files["package.json"];
  if (!raw || !manifestRaw) return;
  const expected = collectPackageSpecifiers(JSON.parse(manifestRaw));
  const lockfile = parseYaml(raw);
  delete lockfile.catalogs;
  const importer = lockfile.importers?.["."] ?? {};
  for (const key of dependencySectionKeys) {
    for (const [name, entry] of Object.entries(importer[key] ?? {})) {
      if (expected.has(name)) entry.specifier = expected.get(name);
      else delete importer[key][name];
    }
  }
  files["pnpm-lock.yaml"] = stringifyYaml(lockfile, { lineWidth: 0, singleQuote: true });
}

function assertLockfileMatchesPackageJson(bundle, archetype) {
  const manifest = JSON.parse(bundle.files["package.json"]);
  const lockfile = parseYaml(bundle.files["pnpm-lock.yaml"] ?? "") ?? {};
  if (lockfile.catalogs) {
    throw new Error(`${archetype} bundle lockfile still contains workspace catalog metadata`);
  }
  const expected = collectPackageSpecifiers(manifest);
  const actual = collectRootLockfileSpecifiers(lockfile);
  for (const [name, specifier] of expected) {
    const lockfileSpecifier = actual.get(name);
    if (lockfileSpecifier !== specifier) {
      throw new Error(
        `${archetype} bundle lockfile mismatch for ${name}: package.json=${specifier}, pnpm-lock.yaml=${lockfileSpecifier ?? "(missing)"}`,
      );
    }
  }
  for (const name of actual.keys()) {
    if (!expected.has(name)) throw new Error(`${archetype} bundle lockfile has unexpected root dependency ${name}`);
  }
}

function collectPackageSpecifiers(manifest) {
  const specifiers = new Map();
  for (const key of dependencySectionKeys) {
    const deps = manifest[key];
    if (!deps || typeof deps !== "object" || Array.isArray(deps)) continue;
    for (const [name, specifier] of Object.entries(deps)) {
      specifiers.set(name, specifier);
    }
  }
  return specifiers;
}

function collectRootLockfileSpecifiers(lockfile) {
  const specifiers = new Map();
  const importer = lockfile.importers?.["."] ?? {};
  for (const key of dependencySectionKeys) {
    for (const [name, entry] of Object.entries(importer[key] ?? {})) {
      specifiers.set(name, entry?.specifier);
    }
  }
  return specifiers;
}

function fail(message) {
  throw new Error(message);
}

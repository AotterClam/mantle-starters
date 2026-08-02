#!/usr/bin/env node
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { renderHome } from "../web/render-home.mjs";

const root = new URL("..", import.meta.url).pathname;
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const checkOnly = process.argv.includes("--check");
const archetypes = ["blank", "presence", "intake", "publication", "transaction", "reservation", "community"];
const dependencySectionKeys = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

for (const archetype of archetypes) {
  const files = buildBundleFiles(archetype);
  const outPath = join(root, "provision-bundles", `${archetype}.json`);
  const bundleText = JSON.stringify({
    version,
    kind: "mantle-provision-bundle",
    archetype,
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0)),
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
  delete files["pnpm-workspace.yaml"];
  if (archetype !== "blank") {
    delete files["manifests/site.yaml"];
    applyOverlay(files, archetype);
    walk(files, `overlays/${archetype}/generated`, ".mantle/generated");
    files["public/index.html"] = renderHome(
      JSON.parse(overlayText(archetype, "seed.json")),
      archetype,
    );
    const wrangler = JSON.parse(files["wrangler.jsonc"]);
    wrangler.assets = { directory: "./public" };
    files["wrangler.jsonc"] = `${JSON.stringify(wrangler, null, 2)}\n`;
    const hasHandlers = Boolean(files["src/handlers.ts"]);
    files["src/index.ts"] = workerEntry(hasHandlers);
  }
  resolveCatalogPackageJson(files);
  applyProvisionedPackageMetadata(files);
  resolveCatalogLockfile(files);
  stampWranglerTemplate(files);

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
    ...(archetype === "presence" || archetype === "intake"
      ? ['  "turnstile_site_key": "{{TURNSTILE_SITE_KEY}}",']
      : []),
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
    '  "site_owner": {',
    '    "email": "{{SITE_OWNER_EMAIL}}",',
    '    "github_login": "{{ADMIN_GITHUB_LOGIN}}"',
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
    '    "path": null',
    "  }",
    "}",
    "",
  ].join("\n");

  files[".mantle/features.json.template"] = JSON.stringify({
    registry: {
      name: "mantle-starters",
      url: "https://mantle.tools/registry.json",
      bundleBaseUrl: "https://raw.githubusercontent.com/aotter/mantle-starters/{ref}/provision-bundles",
      version: "{{STARTER_REF}}",
    },
    archetype: {
      name: "{{ARCHETYPE}}",
      type: "registry:archetype",
      overlayPath: null,
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
    "Next: inspect the manifest, public page, and business handlers, then offer three paths tailored to the purpose: shape the visual experience, build the first real business workflow, or finish deploy/auth if incomplete. Do not present auth as the only next step.",
    "",
  ].join("\n");
  applyProvisionedReadme(files, archetype);
  return files;
}

function workerEntry(hasHandlers) {
  return [
    'import { createMantleWorker } from "@aotter/mantle/cloudflare";',
    'import { manifest } from "../.mantle/generated/site.js";',
    ...(hasHandlers
      ? ['import { createHandlers } from "./handlers.js";']
      : []),
    "",
    ...(hasHandlers
      ? [
          "export default createMantleWorker<SiteEnv>({",
          "  manifest,",
          "  extend: ({ env }) => ({ handlers: createHandlers(env) }),",
          "});",
        ]
      : ["export default createMantleWorker({ manifest });"]),
    "",
  ].join("\n");
}

function assertBundle(bundle, archetype) {
  for (const required of [
    "package.json",
    "wrangler.jsonc",
    ".mantle/launch-state.json.template",
    ".mantle/features.json.template",
    ".mantle/handoff.md.template",
    ".mantle/generated/site.ts",
    ".mantle/generated/types.d.ts",
    ".mantle/generated/env.d.ts",
    ".agent/skills/mantle-develop/SKILL.md",
    ".agent/skills/mantle-plugin/SKILL.md",
    ".agent/skills/mantle-theme/SKILL.md",
    ".agent/skills/mantle-update/SKILL.md",
    ".claude/skills/mantle-develop/SKILL.md",
    ".claude/skills/mantle-plugin/SKILL.md",
    ".claude/skills/mantle-theme/SKILL.md",
    ".claude/skills/mantle-update/SKILL.md",
    "src/index.ts",
  ]) {
    if (!bundle.files[required]) throw new Error(`${archetype} bundle missing ${required}`);
  }
  if (archetype !== "blank" && !bundle.files[`manifests/${archetype}.yaml`]) {
    throw new Error(`${archetype} bundle missing applied manifest`);
  }
  if (archetype === "blank") {
    for (const forbidden of ["src/home.ts", "components/", "kiwa/", "styles/", "scripts/"]) {
      if (Object.keys(bundle.files).some((path) => path === forbidden || path.startsWith(forbidden))) {
        throw new Error(`blank bundle contains non-headless surface: ${forbidden}`);
      }
    }
    for (const forbidden of [
      "D1DatabaseDriver",
      "KvCacheBinding",
      "createCmsRef",
      "createOAuthProvider",
      "mountServerEndpoints",
    ]) {
      if (bundle.files["src/index.ts"].includes(forbidden)) {
        throw new Error(`blank entry leaks low-level assembly: ${forbidden}`);
      }
    }
  } else {
    if (!bundle.files["public/index.html"]?.includes(`content=\"${archetype}\"`)) {
      throw new Error(`${archetype} bundle is missing its static homepage`);
    }
    const wrangler = parseTemplatedWrangler(bundle.files["wrangler.jsonc"]);
    if (wrangler.assets?.directory !== "./public") {
      throw new Error(`${archetype} bundle does not use Cloudflare static assets`);
    }
  }
  const manifest = JSON.parse(bundle.files["package.json"]);
  if (Object.keys(manifest.dependencies ?? {}).join(",") !== "@aotter/mantle") {
    throw new Error(`${archetype} production dependency budget exceeded`);
  }
  assertLockfileMatchesPackageJson(bundle, archetype);
  assertProvisionedReadme(bundle, archetype);
}

function stampWranglerTemplate(files) {
  const wrangler = JSON.parse(files["wrangler.jsonc"]);
  wrangler.name = "{{PROJECT_NAME}}";
  const database = wrangler.d1_databases?.find(({ binding }) => binding === "DB");
  if (database) database.database_name = "{{PROJECT_NAME}}-db";
  wrangler.vars = {
    ...wrangler.vars,
    PUBLIC_ORIGIN: "{{SITE_URL}}",
    MANTLE_SITE_BRAND: "{{BRAND}}",
    MANTLE_SITE_DESCRIPTION: "{{DESCRIPTION}}",
    MANTLE_SITE_LOCALES: "__MANTLE_LOCALES__",
  };
  files["wrangler.jsonc"] = `${JSON.stringify(wrangler, null, 2)
    .replace('"__MANTLE_LOCALES__"', "{{LOCALES}}")}\n`;
}

function parseTemplatedWrangler(source) {
  return JSON.parse(source.replace("{{LOCALES}}", "[]"));
}

function applyProvisionedReadme(files, archetype) {
  const base = files["README.md"];
  if (!base) return;
  const manifestPath = archetype === "blank" ? "manifests/site.yaml" : `manifests/${archetype}.yaml`;
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
    "",
    "## Customize without lock-in",
    "",
    "The minimal default hides SDK assembly; it does not remove developer ownership.",
    "Edit the materialized page and business source directly. For deeper control,",
    "use the typed Worker `extend` seam, copy/eject only a selected version-matched",
    "overlay/component, or switch `src/index.ts` to Core's public low-level",
    "Cloudflare composition recipe. `mantle update` reports changes and never",
    "overwrites project-owned manifest, handler, route, UI, or config files.",
    ...(archetype === "blank"
      ? ["- Type notes: this is the blank base with no seeded visible homepage sections"]
      : [
          "- Public page: `public/index.html`",
          ...(files["src/handlers.ts"] ? ["- Business handlers: `src/handlers.ts`"] : []),
        ]),
    "",
    "## Type notes",
    "",
    archetype === "blank"
      ? "`blank` is the headless Mantle base: edit the manifest, and add business handlers only when the manifest references them. The Worker entry delegates standard Cloudflare assembly to Core."
      : stripMarkdownTitle(overlayText(archetype, "handoff.md")),
    "",
    ...(archetype === "blank"
      ? []
      : [
          "## Layout notes",
          "",
          stripMarkdownTitle(overlayText(archetype, "layout.md")),
          "",
        ]),
  ].join("\n");
  files["README.md"] = `${overview}\n`;
}

function stripMarkdownTitle(text) {
  return text.replace(/^# .*\n+/, "").trim();
}

function assertProvisionedReadme(bundle, archetype) {
  const readme = bundle.files["README.md"] ?? "";
  if (!readme.startsWith("# {{BRAND}}\n")) {
    throw new Error(`${archetype} README must start with the provisioned brand placeholder`);
  }
  for (const required of ["## Launch overview", "## Type notes", ".mantle/handoff.md", ".mantle/launch-state.json"]) {
    if (!readme.includes(required)) throw new Error(`${archetype} README missing ${required}`);
  }
  if (readme.includes("aotter/mantle-starters/blank")) {
    throw new Error(`${archetype} README still reads like the source starter README`);
  }
  const manifestPath = archetype === "blank" ? "manifests/site.yaml" : `manifests/${archetype}.yaml`;
  if (!readme.includes(manifestPath)) throw new Error(`${archetype} README missing manifest path`);
  if (archetype !== "blank") {
    for (const required of ["public/index.html", "## Layout notes"]) {
      if (!readme.includes(required)) throw new Error(`${archetype} README missing ${required}`);
    }
    if (Object.keys(bundle.files).some((path) => path.startsWith(".mantle/overlays/"))) {
      throw new Error(`${archetype} bundle exposes build-only overlay inputs`);
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
  walkIfExists(files, `overlays/${archetype}/src`, "src");
}

function overlayText(archetype, name) {
  return readFileSync(join(root, "overlays", archetype, name), "utf8");
}

function walkIfExists(files, from, to) {
  try {
    statSync(join(root, from));
  } catch {
    return;
  }
  walk(files, from, to);
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
    "scripts",
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

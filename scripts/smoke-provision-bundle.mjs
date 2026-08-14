#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
import { materializeBundle } from "./materialize-bundle.mjs";

const root = new URL("..", import.meta.url).pathname;
const archetypes = ["blank", "presence", "intake", "publication", "transaction", "reservation", "community"];
const operationalCollections = {
  presence: "contact",
  intake: "intake-submissions",
  publication: "post-suggestions",
  transaction: "orders",
  reservation: "reservation-requests",
  community: "community-signups",
};
const replacements = {
  PROJECT_NAME: "bundle-smoke",
  ARCHETYPE: "publication",
  AUTH_MODE: "hosted",
  BRAND: "grid",
  DESCRIPTION: "rotate-45",
  INSTALL_SUMMARY: "Smoke generated from provision bundle.",
  LOCALES: "[\"en\"]",
  CANONICAL_LOCALE: "en",
  STARTER_REF: "smoke",
  GITHUB_OWNER: "aotter",
  ADMIN_GITHUB_LOGIN: "aotter",
  SITE_OWNER_EMAIL: "owner@example.com",
  SITE_URL: "https://bundle-smoke.example",
  AFTER_LAUNCH_SKILL_URL: "https://mantle.tools/skill/after-launch?id=smoke",
  INSTALL_TIMESTAMP: "2026-01-01T00:00:00.000Z",
};

if (isWorkersCacheEnabled("[observability]\nenabled = true\n\n[cache]\nenabled = false\n")) {
  throw new Error("Workers cache check accepted an unrelated enabled flag");
}

for (const archetype of archetypes) {
  const tempRoot = mkdtempSync(join(tmpdir(), `mantle-bundle-${archetype}-`));
  try {
    const bundle = JSON.parse(readFileSync(join(root, "provision-bundles", `${archetype}.json`), "utf8"));
    materializeBundle(tempRoot, bundle, { ...replacements, ARCHETYPE: archetype });
    assertNoLeftovers(tempRoot, bundle.files);
    assertProjectScripts(tempRoot, archetype);
    assertStaticAssets(tempRoot, archetype);
    if (archetype === "blank") {
      assertHeadlessBlank(tempRoot);
    } else {
      assertGeneratedStylesCurrent(tempRoot, archetype);
      assertPublicHomeIsNotHandoff(tempRoot);
      assertMantleSiteSignature(tempRoot, archetype);
      assertStylesheetMounted(tempRoot, archetype);
      assertEdgeCacheContract(tempRoot, archetype);
      assertSectionImageContract(tempRoot, archetype);
      assertLocaleNavigation(tempRoot, archetype);
      assertRuntimeHasNoKiwaDemoCopy(tempRoot, archetype);
      assertAgentSurface(tempRoot, archetype);
    }
    const launchState = JSON.parse(readFileSync(join(tempRoot, ".mantle", "launch-state.json"), "utf8"));
    if (launchState.github?.owner !== replacements.GITHUB_OWNER) throw new Error(`${archetype} missing landing GitHub owner`);
    if (launchState.site_url !== replacements.SITE_URL) throw new Error(`${archetype} missing launch-state site_url`);
    if (launchState.purpose !== replacements.DESCRIPTION) throw new Error(`${archetype} missing launch-state purpose`);
    if (launchState.after_launch_skill_url !== replacements.AFTER_LAUNCH_SKILL_URL) throw new Error(`${archetype} missing after-launch skill URL`);
    const handoff = readFileSync(join(tempRoot, ".mantle", "handoff.md"), "utf8");
    if (!handoff.includes(`Auth intent: ${replacements.AUTH_MODE}`)) throw new Error(`${archetype} missing auth intent handoff`);
    if (!readFileSync(join(tempRoot, "wrangler.toml"), "utf8").includes(`MANTLE_AUTH_MODE = "${replacements.AUTH_MODE}"`)) {
      throw new Error(`${archetype} missing explicit runtime auth mode`);
    }

    const features = JSON.parse(readFileSync(join(tempRoot, ".mantle", "features.json"), "utf8"));
    if (features?.archetype?.name !== archetype) throw new Error(`${archetype} features archetype mismatch`);
    if (archetype !== "blank") {
      if (!features?.archetype?.appliedAt) throw new Error(`${archetype} overlay not marked applied`);
      assertFourAtoms(tempRoot, archetype);
      assertPublicMutationInputsStrict(tempRoot, archetype);
      assertServerOwnedFields(tempRoot, archetype);
      assertOperationalCollection(tempRoot, archetype);
      assertSeedDrivenHome(tempRoot, archetype);
      readFileSync(join(tempRoot, ".mantle", "overlays", archetype, "seed.json"), "utf8");
      if (archetype === "presence") {
        assertPresenceHandlerLoaded(tempRoot);
        assertPresenceContactForm(tempRoot);
      }
      if (archetype === "intake") {
        assertIntakeHandlerLoaded(tempRoot);
        assertIntakeForm(tempRoot);
      } else {
        assertNoIntakeRuntime(tempRoot, archetype);
      }
      if (archetype === "publication") {
        assertPublicationSeed(tempRoot);
        assertTranslationPair(tempRoot);
      }
      if (archetype === "transaction") {
        assertTransactionSeed(tempRoot);
        assertTransactionPublicSurface(tempRoot);
      }
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
smokeLocalMaterializer();
console.log("provision bundle smoke passed");

function assertProjectScripts(root, archetype) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const expected = "mantle-harness indexes --manifests manifests --require-public --format text";
  if (manifest.scripts?.["check:indexes"] !== expected) {
    throw new Error(`${archetype} missing the required index-coverage script`);
  }
  const check = manifest.scripts?.check ?? "";
  if (!check.includes("check:generated") || check.indexOf("check:generated") > check.indexOf("typecheck")) {
    throw new Error(`${archetype} check must detect generated drift before typecheck can rewrite it`);
  }
}

function smokeLocalMaterializer() {
  const tempRoot = mkdtempSync(join(tmpdir(), "mantle-materialize-"));
  const output = join(tempRoot, "northstar");
  const shopOutput = join(tempRoot, "five-language-shop");
  try {
    const result = spawnSync(process.execPath, [
      "scripts/dev-provision-bundle.mjs",
      "presence",
      "--out",
      output,
      "--brand",
      "Northstar Studio",
      "--description",
      "A local Mantle presence site.",
      "--locales",
      "en,zh-TW",
    ], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`local materializer failed: ${result.stderr || result.stdout}`);
    }
    const launch = JSON.parse(readFileSync(join(output, ".mantle", "launch-state.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(output, "package.json"), "utf8"));
    if (launch.authMode !== "self-managed") throw new Error("local auth mode missing");
    if (launch.brand !== "Northstar Studio") throw new Error("local brand mismatch");
    if (JSON.stringify(launch.locales) !== '["en","zh-TW"]') throw new Error("local locales mismatch");
    if (manifest.name !== "northstar") throw new Error("local package name mismatch");
    if (manifest.description !== "A local Mantle presence site.") throw new Error("local package description mismatch");
    const wrangler = readFileSync(join(output, "wrangler.toml"), "utf8");
    if (!wrangler.includes('name = "northstar"')) throw new Error("local Worker name mismatch");
    if (!wrangler.includes('database_name = "northstar-db"')) throw new Error("local D1 name mismatch");
    if (!wrangler.includes('PUBLIC_ORIGIN = "http://localhost:8787"')) throw new Error("local origin missing");
    assertGeneratedStylesMatchStarterLock(output);
    const shop = spawnSync(process.execPath, [
      "scripts/dev-provision-bundle.mjs",
      "transaction",
      "--out",
      shopOutput,
      "--brand",
      "Five Language Shop",
      "--description",
      "A localized transaction starter.",
      "--locales",
      "en,zh-TW,ja,ko,fr",
    ], { cwd: root, encoding: "utf8" });
    if (shop.status !== 0) throw new Error(`five-language materializer failed: ${shop.stderr || shop.stdout}`);
    for (const path of ["seed.json", "messages.json"]) {
      const catalog = JSON.parse(readFileSync(join(shopOutput, ".mantle", "overlays", "transaction", path), "utf8"));
      if (JSON.stringify(Object.keys(catalog.locales)) !== '["en","zh-TW","ja","ko","fr"]') {
        throw new Error(`transaction ${path} was not reduced to the selected locales`);
      }
    }
    const unsupported = spawnSync(process.execPath, [
      "scripts/dev-provision-bundle.mjs",
      "transaction",
      "--out",
      join(tempRoot, "unsupported-shop"),
      "--locales",
      "en,nl",
    ], { cwd: root, encoding: "utf8" });
    if (unsupported.status === 0 || !`${unsupported.stderr}${unsupported.stdout}`.includes("does not support locales: nl")) {
      throw new Error("transaction materializer accepted an unsupported locale");
    }
    const overwrite = spawnSync(process.execPath, [
      "scripts/dev-provision-bundle.mjs",
      "blank",
      "--out",
      output,
    ], { cwd: root, encoding: "utf8" });
    if (overwrite.status === 0) throw new Error("local materializer overwrote a non-empty directory");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assertGeneratedStylesMatchStarterLock(root) {
  const css = readFileSync(join(root, "public", "assets", "styles.css"), "utf8");
  const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
  const cssVersion = css.match(/tailwindcss v([^\s]+)/)?.[1];
  const lockVersion = lock.match(/^\s+tailwindcss:\n\s+specifier:[^\n]+\n\s+version:\s+([^\s]+)/m)?.[1];
  if (!cssVersion || !lockVersion || cssVersion !== lockVersion) {
    throw new Error(`generated styles use Tailwind ${cssVersion ?? "unknown"}, starter lock uses ${lockVersion ?? "unknown"}`);
  }
}

function assertGeneratedStylesCurrent(targetRoot, archetype) {
  symlinkSync(join(root, "recipes", "typed-web", "node_modules"), join(targetRoot, "node_modules"), "dir");
  const result = spawnSync(process.execPath, [
    join(root, "recipes", "typed-web", "scripts", "build-styles.mjs"),
    "--root",
    targetRoot,
    "--check",
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${archetype} generated styles are stale: ${result.stderr || result.stdout}`);
  }
}

function assertHeadlessBlank(root) {
  const files = [
    "manifests/site.yaml",
    "src/auth.ts",
    "src/index.ts",
    ".mantle/generated/site.ts",
    ".mantle/generated/types.d.ts",
  ];
  for (const path of files) readFileSync(join(root, path), "utf8");
  const worker = readFileSync(join(root, "src", "index.ts"), "utf8");
  if (!worker.includes("createMantleWorker") || !worker.includes(".mantle/generated/site.js")) {
    throw new Error("blank Worker does not use the generated manifest and Core facade");
  }
  if (!worker.includes("auth: buildAuth")) throw new Error("blank Worker does not own its auth composition");
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (JSON.stringify(Object.keys(manifest.dependencies ?? {})) !== '["@aotter/mantle"]') {
    throw new Error("blank production dependency must be @aotter/mantle only");
  }
  for (const path of ["components", "kiwa", "lib", "scripts", "styles", "src/web", "src/worker", "src/mantle"]) {
    if (existsSync(join(root, path))) throw new Error(`blank includes typed/UI source: ${path}`);
  }
}

function assertNoLeftovers(root, files) {
  const leftovers = [];
  for (const path of Object.keys(files ?? {})) {
    const target = join(root, path.replace(/\.template$/, ""));
    const text = readFileSync(target, "utf8");
    if (/\{\{[A-Z_][A-Z0-9_]*\}\}/.test(text)) leftovers.push(path);
  }
  if (leftovers.length) throw new Error(`unfilled placeholders: ${leftovers.join(", ")}`);
}

function assertPublicHomeIsNotHandoff(root) {
  const text = readSource(root);
  for (const forbidden of ["ready for your coding agent", "Copy this prompt", "Open this live site URL"]) {
    if (text.includes(forbidden)) throw new Error(`public homepage still contains handoff text: ${forbidden}`);
  }
}

function assertMantleSiteSignature(root, archetype) {
  const text = readSource(root);
  if (!text.includes('<meta name="mantle:site" content="v1" />')) {
    throw new Error(`${archetype} missing Mantle site signature meta`);
  }
}

function assertStylesheetMounted(root, archetype) {
  const source = readSource(root);
  const css = readFileSync(join(root, "public", "assets", "styles.css"), "utf8");
  if (!source.includes("/assets/styles.css")) {
    throw new Error(`${archetype} homepage does not link generated stylesheet`);
  }
  if (source.includes("mountAssetRoutes") || source.includes("stylesCss")) {
    throw new Error(`${archetype} still serves generated assets through the Worker`);
  }
  if (!css.includes("tailwindcss") || !css.includes(".bg-primary")) {
    throw new Error(`${archetype} generated stylesheet does not include Kiwa/Tailwind utilities`);
  }
  if (css.includes("@import")) {
    throw new Error(`${archetype} generated stylesheet contains a late CSS import`);
  }
}

function assertEdgeCacheContract(root, archetype) {
  const wrangler = readFileSync(join(root, "wrangler.toml"), "utf8");
  const source = readSource(root);
  for (const required of [
    'compatibility_date = "2026-07-31"',
    "[observability]",
  ]) {
    if (!wrangler.includes(required)) {
      throw new Error(`${archetype} wrangler config missing ${required}`);
    }
  }
  if (!isWorkersCacheEnabled(wrangler)) {
    throw new Error(`${archetype} must enable the top-level Workers cache`);
  }
  if (wrangler.includes("cross_version_cache")) {
    throw new Error(`${archetype} must keep the default per-version Workers cache`);
  }
  if (source.includes("rsms.me/inter")) {
    throw new Error(`${archetype} still loads the render-blocking remote Inter font`);
  }
  for (const required of [
    'width="1200"',
    'height="900"',
    'fetchpriority="high"',
  ]) {
    if (!source.includes(required)) {
      throw new Error(`${archetype} cache/LCP contract missing ${required}`);
    }
  }
}

function assertStaticAssets(root, archetype) {
  const wrangler = readFileSync(join(root, "wrangler.toml"), "utf8");
  if (!wrangler.includes('[assets]\ndirectory = "./public"\nbinding = "ASSETS"')) {
    throw new Error(`${archetype} does not use Cloudflare Static Assets`);
  }
  const icon = readFileSync(join(root, "public", "site-icon.svg"), "utf8");
  if (!icon.startsWith("<svg") || !readSource(root).includes('src: "/site-icon.svg"')) {
    throw new Error(`${archetype} does not declare one shared site icon`);
  }
}

function isWorkersCacheEnabled(wrangler) {
  return /^\[cache\]\s*\nenabled\s*=\s*true\s*$/m.test(wrangler);
}

function assertSectionImageContract(root, archetype) {
  const renderer = readFileSync(join(root, "src", "web", "sections", "renderers", "hero.tsx"), "utf8");
  if (!renderer.includes("image={section.image}")) {
    throw new Error(`${archetype} hero does not render its declared image`);
  }
  const contentRendererPath = join(root, "src", "web", "sections", "renderers", "content.tsx");
  if (existsSync(contentRendererPath)
      && !readFileSync(contentRendererPath, "utf8").includes("image={section.image}")) {
    throw new Error(`${archetype} content does not render its declared image`);
  }
  const manifestPath = join(root, "manifests", "site.yaml");
  const atoms = parseAllDocuments(readFileSync(manifestPath, "utf8"))
    .map((document) => document.toJSON());
  const page = atoms
    .find((atom) => atom?.kind === "Schema" && atom?.metadata?.name === "page-translations")
    ?? atoms.find((atom) => atom?.kind === "Schema" && atom?.metadata?.name === "page");
  if (!page) throw new Error(`${archetype} seed homepage has no page Schema`);
  const home = atoms.find((atom) => atom?.kind === "View" && atom?.metadata?.name === "home");
  if (!["page", "page-translations"].includes(home?.spec?.from)) {
    throw new Error(`${archetype} page lifecycle has no published home View`);
  }
  if (page.spec?.schema?.properties?.sections?.items?.properties?.showImage?.type !== "boolean") {
    throw new Error(`${archetype} page Schema does not expose showImage`);
  }
  const image = page?.spec?.schema?.properties?.sections?.items?.properties?.image;
  if (
    (
      image?.type !== "object"
      || image.properties?.src?.type !== "string"
      || image.properties?.alt?.type !== "string"
      || !image.required?.includes("src")
      || !image.required?.includes("alt")
    )
  ) {
    throw new Error(`${archetype} page Schema does not expose an accessible hero image`);
  }
  const seed = JSON.parse(
    readFileSync(join(root, ".mantle", "overlays", archetype, "seed.json"), "utf8"),
  );
  const pageSeed = seed.locales
    ? Object.values(seed.locales).flatMap((pack) => pack?.["page-translations"] ?? [])
    : seed.collections?.["page-translations"] ?? seed.collections?.page;
  const hero = pageSeed?.[0]?.sections?.find((section) => section.type === "hero");
  if (hero?.image?.src !== "/assets/mantle-ocean-hero-light.svg" || hero.image.alt !== "") {
    throw new Error(`${archetype} seed does not reference the shared ocean hero`);
  }
  const homeContent = readFileSync(join(root, "src", "web", "content", "homeContent.ts"), "utf8");
  if (!homeContent.includes('views["home"](')) {
    throw new Error(`${archetype} homepage never reads its home View`);
  }
  const theme = readFileSync(join(root, "src", "web", "client", "themeClient.ts"), "utf8");
  for (const path of ["mantle-ocean-hero-light.svg", "mantle-ocean-hero-dark.svg"]) {
    const svg = readFileSync(join(root, "public", "assets", path), "utf8");
    if (!svg.startsWith("<svg") || !theme.includes(path)) {
      throw new Error(`${archetype} ocean hero ${path} is not wired through static assets and theme`);
    }
  }
}

function assertLocaleNavigation(root, archetype) {
  const nav = readFileSync(join(root, "components", "blocks", "marketing", "nav-02.tsx"), "utf8");
  if (
    !nav.includes("data-locale-switch")
    || !nav.includes("locales.length > 1")
    || !nav.includes("Intl.DisplayNames")
    || !nav.includes("bottom-full")
  ) {
    throw new Error(`${archetype} does not expose the shared locale switch`);
  }
}

function assertOperationalCollection(root, archetype) {
  const collection = operationalCollections[archetype];
  if (!collection) return;
  const manifestPath = join(root, "manifests", "site.yaml");
  const schema = parseAllDocuments(readFileSync(manifestPath, "utf8"))
    .map((document) => document.toJSON())
    .find((atom) => atom?.kind === "Schema" && atom?.metadata?.name === collection);
  if (schema?.spec?.lifecycle !== "operational") {
    throw new Error(`${archetype} operational collection ${collection} must use lifecycle:operational`);
  }
  const seed = JSON.parse(
    readFileSync(join(root, ".mantle", "overlays", archetype, "seed.json"), "utf8"),
  );
  if ((seed.collections?.[collection] ?? []).length > 0) {
    throw new Error(`${archetype} seed contains fake operational data for ${collection}`);
  }
}

function assertNoIntakeRuntime(root, archetype) {
  for (const path of ["src/web/sections/intakeSection.tsx", "src/web/client/intakeClient.ts"]) {
    if (existsSync(join(root, path))) throw new Error(`${archetype} bundle includes intake-only runtime: ${path}`);
  }
}

function assertRuntimeHasNoKiwaDemoCopy(root, archetype) {
  const files = [
    "src/web/pages/HomePage.tsx",
    "src/web/sections/renderSection.tsx",
    "src/web/content/homeContent.ts",
    "src/web/content/siteContent.ts",
    "components/blocks/marketing/bento-02.tsx",
    "components/blocks/marketing/contact-02.tsx",
    "components/blocks/marketing/content-01.tsx",
    "components/blocks/marketing/cta-02.tsx",
    "components/blocks/marketing/faq-02.tsx",
    "components/blocks/marketing/features-02.tsx",
    "components/blocks/marketing/footer-02.tsx",
    "components/blocks/marketing/hero-02.tsx",
    "components/blocks/marketing/metrics-02.tsx",
    "components/blocks/marketing/nav-02.tsx",
    "components/blocks/marketing/social-proof-02.tsx",
    "components/blocks/marketing/testimonials-02.tsx",
  ];
  const forbidden = [
    "Kiwa UI",
    "Your workflow, supercharged with AI",
    "Start free trial",
    "Book a demo",
    "Trusted by product-led teams everywhere",
    "We started Kiwa UI",
    "hello@kiwaui.com",
    "Frequently asked questions",
    "Get in touch",
    "Your Company",
  ];
  for (const file of files) {
    if (!existsSync(join(root, file))) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const needle of forbidden) {
      if (text.includes(needle)) {
        throw new Error(`${archetype} runtime still contains Kiwa demo copy: ${file}: ${needle}`);
      }
    }
  }
}

function assertFourAtoms(root, archetype) {
  const text = readFileSync(join(root, "manifests", "site.yaml"), "utf8");
  for (const atom of ["Schema", "View", "Procedure", "Trigger"]) {
    if (!new RegExp(`kind:\\s*${atom}\\b`).test(text)) {
      throw new Error(`${archetype} manifest missing ${atom}`);
    }
  }
}

function assertPublicMutationInputsStrict(root, archetype) {
  const text = readFileSync(join(root, "manifests", "site.yaml"), "utf8");
  const atoms = parseAllDocuments(text).map((document) => document.toJSON());
  const publicNames = new Set(atoms
    .filter((atom) => atom?.kind === "Trigger" && atom?.spec?.source?.kind === "http")
    .map((atom) => atom?.spec?.target?.procedure)
    .filter(Boolean));
  const publicMutations = atoms.filter((atom) => atom?.kind === "Procedure" && publicNames.has(atom?.metadata?.name));
  if (!publicMutations.length) throw new Error(`${archetype} missing public mutation`);
  for (const procedure of publicMutations) {
    if (procedure.spec.input?.additionalProperties !== false) {
      throw new Error(`${procedure.metadata?.name} silently accepts undeclared fields`);
    }
  }
}

function assertServerOwnedFields(root, archetype) {
  const atoms = parseAllDocuments(readFileSync(join(root, "manifests", "site.yaml"), "utf8"))
    .map((document) => document.toJSON());
  const schemas = new Map(
    atoms.filter((atom) => atom?.kind === "Schema").map((atom) => [atom.metadata?.name, atom]),
  );
  for (const procedure of atoms.filter((atom) => atom?.kind === "Procedure" && atom?.spec?.handler?.op === "create")) {
    const schema = schemas.get(procedure.spec.handler.schema);
    for (const [field, property] of Object.entries(schema?.spec?.schema?.properties ?? {})) {
      if (!property?.["x-mantle-bind"]) continue;
      if (!["ctx.user", "ctx.staff", "now"].includes(property["x-mantle-bind"])) {
        throw new Error(`${archetype} uses an unsupported server-owned bind for ${field}`);
      }
      const input = procedure.spec.input ?? {};
      if (input.required?.includes(field) || Object.hasOwn(input.properties ?? {}, field)) {
        throw new Error(`${archetype} create input exposes server-owned field ${field}`);
      }
      if (property["x-mantle-bind"] === "now" && (property.type !== "integer" || property["x-mcp-hint"] !== "timestamp-ms")) {
        throw new Error(`${archetype} now-bound field ${field} must be an integer timestamp-ms`);
      }
    }
  }
}

function assertPresenceHandlerLoaded(root) {
  const text = readFileSync(join(root, "src", "mantle", "handlers", "index.ts"), "utf8");
  if (!text.includes('"notify-contact": notifyContact')) {
    throw new Error("presence overlay did not install notify-contact handler");
  }
  if (!text.includes('"verify-contact-turnstile": verifyContactTurnstile')) {
    throw new Error("presence overlay did not install verify-contact-turnstile handler");
  }
}

function assertPresenceContactForm(root) {
  const text = readSource(root);
  const seed = readFileSync(join(root, ".mantle", "overlays", "presence", "seed.json"), "utf8");
  if (!text.includes("data-mantle-form")) {
    throw new Error("presence homepage does not mark forms for JSON submit");
  }
  if (!text.includes("content-type': 'application/json'")) {
    throw new Error("presence contact form submit does not send JSON");
  }
  if (!text.includes("cf-turnstile")) {
    throw new Error("presence contact form is missing Turnstile support");
  }
  if (!seed.includes('"type": "form"') || !seed.includes('"/api/contact"')) {
    throw new Error("presence seed does not define the contact form section");
  }
}

function assertIntakeHandlerLoaded(root) {
  const text = readFileSync(join(root, "src", "mantle", "handlers", "index.ts"), "utf8");
  if (!text.includes('"notify-intake": notifyIntake')) {
    throw new Error("intake overlay did not install notify-intake handler");
  }
  if (!text.includes('"verify-intake-turnstile": verifyIntakeTurnstile')) {
    throw new Error("intake overlay did not install verify-intake-turnstile handler");
  }
}

function assertIntakeForm(root) {
  const text = [
    readSource(root),
    readFileSync(join(root, "src", "web", "sections", "intakeSection.tsx"), "utf8"),
    readFileSync(join(root, "src", "web", "client", "intakeClient.ts"), "utf8"),
  ].join("\n");
  const fieldControl = readFileSync(
    join(root, "src", "web", "sections", "fieldControl.tsx"),
    "utf8",
  );
  const seed = readFileSync(join(root, ".mantle", "overlays", "intake", "seed.json"), "utf8");
  const manifest = readFileSync(join(root, "manifests", "site.yaml"), "utf8");
  const notify = readFileSync(
    join(root, "src", "worker", "features", "intake", "notifyIntake.ts"),
    "utf8",
  );
  if (!text.includes("data-intake-form")) {
    throw new Error("intake homepage does not render the intake form surface");
  }
  if (!text.includes("mantle:form-success")) {
    throw new Error("intake homepage does not render a saved-response result state");
  }
  if (!text.includes("content-type': 'application/json'")) {
    throw new Error("intake form submit does not send JSON");
  }
  if (
    !text.includes("data-intake-progress-template")
    || !text.includes("dataset.intakeProgressTemplate")
  ) {
    throw new Error("intake progress copy is not seed-driven");
  }
  if (!text.includes('name="replyLocale"') || !text.includes("value={locale}")) {
    throw new Error("intake form does not submit its rendered locale");
  }
  if (!fieldControl.includes("<fieldset") || !fieldControl.includes("<legend")) {
    throw new Error("intake option groups do not use fieldset and legend semantics");
  }
  if (!seed.includes('"type": "intake"') || !seed.includes('"/api/intake"')) {
    throw new Error("intake seed does not define the intake section");
  }
  if (
    !seed.includes('"locale": "en"')
    || !seed.includes('"intakeLabels"')
  ) {
    throw new Error("intake seed does not define localized chrome and reply language");
  }
  if (!manifest.includes("required: [name, email, attendance, resultKey, replyLocale]")) {
    throw new Error("intake manifest does not persist reply language");
  }
  assertIntakeOptionContract(JSON.parse(seed), manifest);
  if (!notify.includes("Reply language:")) {
    throw new Error("intake notification does not expose reply language");
  }
}

function assertIntakeOptionContract(seed, manifestText) {
  const atoms = parseAllDocuments(manifestText).map((document) => document.toJSON());
  const stored = atoms.find(
    (atom) => atom?.kind === "Schema" && atom?.metadata?.name === "intake-submissions",
  )?.spec?.schema?.properties;
  const input = atoms.find(
    (atom) => atom?.kind === "Procedure" && atom?.metadata?.name === "submit-intake",
  )?.spec?.input?.properties;
  const section = seed.collections?.page?.[0]?.sections?.find(
    (candidate) => candidate.type === "intake",
  );
  for (const field of section?.fields ?? []) {
    if (!field.options?.length) continue;
    const values = field.options.map((option) => option.value);
    if (
      JSON.stringify(stored?.[field.name]?.enum) !== JSON.stringify(values)
      || JSON.stringify(input?.[field.name]?.enum) !== JSON.stringify(values)
    ) {
      throw new Error(`intake option values for ${field.name} drifted from the manifest`);
    }
  }
  const resultKeys = (section?.results ?? []).map((result) => result.key);
  if (
    JSON.stringify(stored?.resultKey?.enum) !== JSON.stringify(resultKeys)
    || JSON.stringify(input?.resultKey?.enum) !== JSON.stringify(resultKeys)
  ) {
    throw new Error("intake result keys drifted from the manifest");
  }
}

function assertPublicationSeed(root) {
  const seed = readFileSync(join(root, ".mantle", "overlays", "publication", "seed.json"), "utf8");
  if (!seed.includes('"site"') || !seed.includes('"type": "home"')) {
    throw new Error("publication seed does not drive site/page content");
  }
  if (!seed.includes('"posts"') || !seed.includes('"post-translations"') || !seed.includes('"slug": "welcome"')) {
    throw new Error("publication seed does not include starter posts");
  }
}

function assertTranslationPair(root) {
  const schemas = parseAllDocuments(readFileSync(join(root, "manifests", "site.yaml"), "utf8"))
    .map((document) => document.toJSON())
    .filter((atom) => atom?.kind === "Schema");
  const parent = schemas.find((schema) => schema.metadata?.name === "posts");
  const child = schemas.find((schema) => schema.metadata?.name === "post-translations");
  if (parent?.spec?.localized || child?.spec?.localized !== true) {
    throw new Error("publication translation pair must have a non-localized parent and localized child");
  }
  if (child?.spec?.translates?.parent !== "posts" || child.spec.translates.on !== "slug") {
    throw new Error("publication translation pair must join post-translations to posts by slug");
  }
}

function assertSeedDrivenHome(root, archetype) {
  const homeContent = readFileSync(join(root, "src", "web", "content", "homeContent.ts"), "utf8");
  const seedRuntime = readFileSync(join(root, "src", "mantle", "seed.ts"), "utf8");
  const worker = readFileSync(join(root, "src", "mantle", "worker.ts"), "utf8");
  const seedImport = `../../.mantle/overlays/${archetype}/seed.json`;
  if (!seedRuntime.includes(seedImport) || !worker.includes("createSeededRuntime")) {
    throw new Error(`${archetype} does not initialize D1 from the overlay seed`);
  }
  if (homeContent.includes(seedImport) || homeContent.includes("fallback")) {
    throw new Error(`${archetype} homepage still has a seed fallback`);
  }
}

function assertTransactionSeed(root) {
  const seed = readFileSync(join(root, ".mantle", "overlays", "transaction", "seed.json"), "utf8");
  const parsed = JSON.parse(seed);
  const locales = Object.keys(parsed.locales ?? {});
  if (
    !seed.includes('"type": "home"')
    || parsed.collections?.products?.length !== 1
    || parsed.collections.products[0]?.slug !== "sample-product"
    || locales.length !== 1
    || parsed.locales[locales[0]]?.["product-translations"]?.length !== 1
    || parsed.locales[locales[0]]?.["page-translations"]?.length !== 2
  ) {
    throw new Error("transaction seed does not include localized home/about and one sample product");
  }
  const messages = JSON.parse(readFileSync(join(root, ".mantle", "overlays", "transaction", "messages.json"), "utf8"));
  if (JSON.stringify(Object.keys(messages.locales)) !== JSON.stringify(locales)) {
    throw new Error("transaction entry and message locale catalogs differ");
  }
  const about = parsed.locales[locales[0]]?.["page-translations"]?.find((entry) => entry.slug === "about");
  if (about?.sections?.[0]?.image?.src !== "/assets/mantle-ocean-hero-light.svg") {
    throw new Error("transaction About seed is missing its image");
  }
  const home = parsed.locales[locales[0]]?.["page-translations"]?.find((entry) => entry.slug === "home");
  const featuredProduct = home?.sections?.find((section) => section.id === "products")?.items?.[0];
  const product = parsed.locales[locales[0]]?.["product-translations"]?.[0];
  if (
    parsed.collections.products[0]?.coverUrl !== "/assets/mantle-ocean-hero-light.svg"
    || featuredProduct?.href !== "/products/sample-product"
    || !product?.description
  ) {
    throw new Error("transaction sample product must include a cover, description, and seeded homepage link");
  }
  const schemas = parseAllDocuments(readFileSync(join(root, "manifests", "site.yaml"), "utf8"))
    .map((document) => document.toJSON())
    .filter((atom) => atom?.kind === "Schema");
  for (const [childName, parentName] of [["page-translations", "page"], ["product-translations", "products"]]) {
    const child = schemas.find((schema) => schema.metadata?.name === childName);
    if (child?.spec?.localized !== true || child.spec?.translates?.parent !== parentName || child.spec.translates.on !== "slug") {
      throw new Error(`transaction ${childName} must translate ${parentName} by slug`);
    }
  }
  const orders = schemas.find((schema) => schema.metadata?.name === "orders");
  if (!orders?.spec?.schema?.properties?.orderLocale || orders.spec.schema.properties.locale) {
    throw new Error("transaction orders must store orderLocale without using the reserved entry locale field");
  }
}

function assertTransactionPublicSurface(root) {
  const worker = readFileSync(join(root, "src", "index.ts"), "utf8");
  const composition = readFileSync(join(root, "src", "mantle", "worker.ts"), "utf8");
  const surface = readFileSync(join(root, "src", "web", "publicSite.tsx"), "utf8");
  const page = readFileSync(join(root, "src", "web", "pages", "HomePage.tsx"), "utf8");
  const content = readFileSync(join(root, "src", "web", "content", "siteContent.ts"), "utf8");
  const client = readFileSync(join(root, "src", "web", "client", "homeClient.ts"), "utf8");
  const nav = readFileSync(join(root, "components", "blocks", "marketing", "nav-02.tsx"), "utf8");
  const features = readFileSync(join(root, "components", "blocks", "marketing", "features-02.tsx"), "utf8");
  const wrangler = readFileSync(join(root, "wrangler.toml"), "utf8");
  if (!composition.includes("mountPublicRoutes") || !composition.includes("publicPathResolver")) {
    throw new Error("transaction Worker does not mount the Core public route surface");
  }
  for (const required of [
    'registerEntryTemplate("product-translations"',
    'registerListTemplate("product-translations"',
    'registerEntryTemplate("page-translations"',
    'registerListTemplate("page-translations"',
    'segment: "products"',
    'segment: "pages"',
  ]) {
    if (!surface.includes(required)) throw new Error(`transaction public surface missing ${required}`);
  }
  for (const required of [
    'name = "INVENTORY_COORDINATOR"',
    'binding = "ORDER_EXPIRY_QUEUE"',
    'max_concurrency = 1',
    'crons = ["*/5 * * * *"]',
  ]) {
    if (!wrangler.includes(required)) throw new Error(`transaction Worker binding missing ${required}`);
  }
  for (const required of [
    'procedures["expire-order"]',
    'procedures["sweep-expired-orders"]',
    "for (const message of batch.messages)",
    "async scheduled(",
    'result.diagnostic.code === "CONFLICT"',
  ]) {
    if (!worker.includes(required)) throw new Error(`transaction lifecycle worker missing ${required}`);
  }
  if (worker.includes("batch.messages[0]")) throw new Error("transaction queue processes only the first batch message");
  const scheduled = worker.slice(worker.indexOf("async scheduled("));
  if (scheduled.includes("ORDER_EXPIRY_QUEUE") || scheduled.includes(".send(")) {
    throw new Error("transaction scheduled handler fans work into the expiry queue");
  }
  if (!client.includes("commerceClientJs")) throw new Error("transaction client bundle is missing cart behavior");
  if (!nav.includes("ShoppingCartIcon") || !nav.includes("data-cart-count")) {
    throw new Error("transaction navigation is missing the cart icon/count surface");
  }
  if (!features.includes("href={feature.href}")) {
    throw new Error("transaction homepage feature cards do not link to their seeded href");
  }
  if (content.includes('message["nav.home"]') || !page.includes('value === "/"')) {
    throw new Error("transaction navigation must use the brand as home without generating /:locale/");
  }
}

function assertAgentSurface(root, archetype) {
  const composition = readFileSync(join(root, "src", "mantle", "worker.ts"), "utf8");
  const surface = readFileSync(join(root, "src", "web", "publicSite.tsx"), "utf8");
  for (const required of [
    "mountPublicRoutes",
    "publicPathResolver",
    "homeMarkdown: renderHomeMarkdown",
  ]) {
    if (!composition.includes(required)) throw new Error(`${archetype} agent surface missing ${required}`);
  }
  for (const required of ["renderPublicHome", "renderHomeMarkdown", "renderNotFound"]) {
    if (!surface.includes(required)) throw new Error(`${archetype} public renderer missing ${required}`);
  }
}

function readSource(root) {
  return ["src", "components", "lib"].flatMap((path) => readTree(join(root, path))).join("\n");
}

function readTree(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [readFileSync(path, "utf8")];
  return readdirSync(path).flatMap((name) => readTree(join(path, name)));
}

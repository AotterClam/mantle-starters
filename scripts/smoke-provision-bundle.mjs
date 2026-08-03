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
  transaction: "product-inquiries",
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
    if (archetype === "blank") {
      assertHeadlessBlank(tempRoot);
    } else {
      assertGeneratedStylesCurrent(tempRoot, archetype);
      assertPublicHomeIsNotHandoff(tempRoot);
      assertMantleSiteSignature(tempRoot, archetype);
      assertStylesheetMounted(tempRoot, archetype);
      assertEdgeCacheContract(tempRoot, archetype);
      assertSectionImageContract(tempRoot, archetype);
      assertRuntimeHasNoKiwaDemoCopy(tempRoot, archetype);
    }
    const launchState = JSON.parse(readFileSync(join(tempRoot, ".mantle", "launch-state.json"), "utf8"));
    if (launchState.github?.owner !== replacements.GITHUB_OWNER) throw new Error(`${archetype} missing landing GitHub owner`);
    if (launchState.site_url !== replacements.SITE_URL) throw new Error(`${archetype} missing launch-state site_url`);
    if (launchState.purpose !== replacements.DESCRIPTION) throw new Error(`${archetype} missing launch-state purpose`);
    if (launchState.after_launch_skill_url !== replacements.AFTER_LAUNCH_SKILL_URL) throw new Error(`${archetype} missing after-launch skill URL`);
    const handoff = readFileSync(join(tempRoot, ".mantle", "handoff.md"), "utf8");
    if (!handoff.includes(`Auth intent: ${replacements.AUTH_MODE}`)) throw new Error(`${archetype} missing auth intent handoff`);

    const features = JSON.parse(readFileSync(join(tempRoot, ".mantle", "features.json"), "utf8"));
    if (features?.archetype?.name !== archetype) throw new Error(`${archetype} features archetype mismatch`);
    if (archetype !== "blank") {
      if (!features?.archetype?.appliedAt) throw new Error(`${archetype} overlay not marked applied`);
      assertFourAtoms(tempRoot, archetype);
      assertPublicMutationInputsStrict(tempRoot, archetype);
      assertOperationalCollection(tempRoot, archetype);
      assertNoBlankExampleManifest(tempRoot, archetype);
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
      }
      if (archetype === "transaction") {
        assertTransactionSeed(tempRoot);
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
  const css = readFileSync(join(root, "styles", "generated.css"), "utf8");
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
    "src/index.ts",
    ".mantle/generated/site.ts",
    ".mantle/generated/types.d.ts",
  ];
  for (const path of files) readFileSync(join(root, path), "utf8");
  const worker = readFileSync(join(root, "src", "index.ts"), "utf8");
  if (!worker.includes("createMantleWorker") || !worker.includes(".mantle/generated/site.js")) {
    throw new Error("blank Worker does not use the generated manifest and Core facade");
  }
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
  const css = readFileSync(join(root, "styles", "generated.css"), "utf8");
  if (!source.includes("/assets/styles.css")) {
    throw new Error(`${archetype} homepage does not link generated stylesheet`);
  }
  if (!source.includes("stylesCss")) {
    throw new Error(`${archetype} worker does not mount generated stylesheet`);
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
    "public, max-age=0, s-maxage=300",
    "public, max-age=31536000, immutable",
    'width="1200"',
    'height="900"',
    'fetchpriority="high"',
  ]) {
    if (!source.includes(required)) {
      throw new Error(`${archetype} cache/LCP contract missing ${required}`);
    }
  }
  if (!source.includes("?v=${assetBuild}")) {
    throw new Error(`${archetype} immutable assets are not content-versioned`);
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
  const manifestPath = join(root, "manifests", `${archetype}.yaml`);
  if (!existsSync(manifestPath)) return;
  const page = parseAllDocuments(readFileSync(manifestPath, "utf8"))
    .map((document) => document.toJSON())
    .find((atom) => atom?.kind === "Schema" && atom?.metadata?.name === "page");
  if (
    page
    && page.spec?.schema?.properties?.sections?.items?.properties?.showImage?.type !== "boolean"
  ) {
    throw new Error(`${archetype} page Schema does not expose showImage`);
  }
  const image = page?.spec?.schema?.properties?.sections?.items?.properties?.image;
  if (
    page
    && (
      image?.type !== "object"
      || image.properties?.src?.type !== "string"
      || image.properties?.alt?.type !== "string"
      || !image.required?.includes("src")
      || !image.required?.includes("alt")
    )
  ) {
    throw new Error(`${archetype} page Schema does not expose an accessible hero image`);
  }
}

function assertOperationalCollection(root, archetype) {
  const collection = operationalCollections[archetype];
  if (!collection) return;
  const manifestPath = join(root, "manifests", `${archetype}.yaml`);
  const schema = parseAllDocuments(readFileSync(manifestPath, "utf8"))
    .map((document) => document.toJSON())
    .find((atom) => atom?.kind === "Schema" && atom?.metadata?.name === collection);
  if (schema?.spec?.lifecycle !== "none") {
    throw new Error(`${archetype} operational collection ${collection} must use lifecycle:none`);
  }
  const seed = JSON.parse(
    readFileSync(join(root, ".mantle", "overlays", archetype, "seed.json"), "utf8"),
  );
  if ((seed.collections?.[collection] ?? []).some((entry) => entry.status === "draft")) {
    throw new Error(`${archetype} operational seed ${collection} still declares a draft`);
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
  const text = readFileSync(join(root, "manifests", `${archetype}.yaml`), "utf8");
  for (const atom of ["Schema", "View", "Procedure", "Trigger"]) {
    if (!new RegExp(`kind:\\s*${atom}\\b`).test(text)) {
      throw new Error(`${archetype} manifest missing ${atom}`);
    }
  }
}

function assertPublicMutationInputsStrict(root, archetype) {
  const text = readFileSync(join(root, "manifests", `${archetype}.yaml`), "utf8");
  const publicMutations = parseAllDocuments(text)
    .map((document) => document.toJSON())
    .filter((atom) =>
      atom?.kind === "Procedure"
      && atom?.spec?.handler?.kind === "builtin"
      && atom?.spec?.handler?.op === "create"
    );
  if (!publicMutations.length) throw new Error(`${archetype} missing public mutation`);
  for (const procedure of publicMutations) {
    if (procedure.spec.input?.additionalProperties !== false) {
      throw new Error(`${procedure.metadata?.name} silently accepts undeclared fields`);
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
  const manifest = readFileSync(join(root, "manifests", "intake.yaml"), "utf8");
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
    || !seed.includes('"replyLocale"')
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
  if (!seed.includes('"posts"') || !seed.includes('"slug": "welcome"')) {
    throw new Error("publication seed does not include starter posts");
  }
}

function assertSeedDrivenHome(root, archetype) {
  const homeContent = readFileSync(join(root, "src", "web", "content", "homeContent.ts"), "utf8");
  const seedImport = `../../../.mantle/overlays/${archetype}/seed.json`;
  if (!homeContent.includes(seedImport)) {
    throw new Error(`${archetype} homepage content is not driven by the overlay seed`);
  }
}

function assertTransactionSeed(root) {
  const seed = readFileSync(join(root, ".mantle", "overlays", "transaction", "seed.json"), "utf8");
  const parsed = JSON.parse(seed);
  if (!seed.includes('"type": "home"') || parsed.collections?.products?.length !== 3) {
    throw new Error("transaction seed does not include a visible home and three products");
  }
}

function assertNoBlankExampleManifest(root, archetype) {
  try {
    readFileSync(join(root, "manifests", "example.yaml"), "utf8");
  } catch {
    return;
  }
  throw new Error(`${archetype} bundle still includes blank example manifest`);
}

function readSource(root) {
  return ["src", "components", "lib"].flatMap((path) => readTree(join(root, path))).join("\n");
}

function readTree(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [readFileSync(path, "utf8")];
  return readdirSync(path).flatMap((name) => readTree(join(path, name)));
}

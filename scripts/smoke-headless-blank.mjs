#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { materializeBundle } from "./materialize-bundle.mjs";

const root = resolve(import.meta.dirname, "..");
const tempRoot = mkdtempSync(join(tmpdir(), "mantle-runtime-smoke-"));
const replacements = {
  PROJECT_NAME: "runtime-smoke",
  AUTH_MODE: "self-managed",
  BRAND: "Runtime Smoke",
  DESCRIPTION: "Exact packed cold-start smoke.",
  INSTALL_SUMMARY: "Runtime smoke.",
  LOCALES: '["en"]',
  CANONICAL_LOCALE: "en",
  STARTER_REF: "smoke",
  GITHUB_OWNER: "aotter",
  ADMIN_GITHUB_LOGIN: "",
  SITE_OWNER_EMAIL: "owner@example.com",
  SITE_URL: "http://localhost:8787",
  AFTER_LAUNCH_SKILL_URL: "https://example.com/skill",
  INSTALL_TIMESTAMP: "2026-01-01T00:00:00.000Z",
};

try {
  await smokeBlank();
  await smokeTyped("presence", async (origin) => {
    await assertSeededHome(origin);
    await assertAgentSurface(origin);
  });
  await smokeTyped("publication", async (origin) => {
    await assertSeededHome(origin);
    await assertAgentSurface(origin, [{ segment: "posts", slug: "welcome" }]);
  });
  await smokeTyped("community", async (origin) => {
    await assertSeededHome(origin);
    await assertAgentSurface(origin, [{ segment: "updates", slug: "welcome" }]);
  });
  await smokeTyped("transaction", async (origin) => {
    const home = await fetch(`${origin}/`);
    const html = await home.text();
    if (home.status !== 200 || !html.includes("Sample product")) {
      throw new Error(`transaction homepage did not render its D1 seed catalog (${home.status})`);
    }
    const view = await fetch(`${origin}/api/views/public-products?locale=en`);
    const body = await view.json();
    if (view.status !== 200 || !Array.isArray(body?.data?.rows) || body.data.rows.length !== 1) {
      throw new Error(`transaction View returned ${view.status}: ${JSON.stringify(body)}`);
    }
    const about = await fetch(`${origin}/en/pages/about`);
    if (about.status !== 200 || !(await about.text()).includes("About Runtime Smoke")) {
      throw new Error(`transaction seeded About returned ${about.status}`);
    }
    await assertAgentSurface(origin, [
      { segment: "products", slug: "sample-product" },
      { segment: "pages", slug: "about" },
    ], ["en", "zh-TW", "ja", "ko", "fr"]);
  }, {
    LOCALES: '["en","zh-TW","ja","ko","fr"]',
  });
  await smokeTyped("intake", async (origin) => {
    await assertSeededHome(origin);
    await assertAgentSurface(origin);
    const home = await fetch(`${origin}/`);
    const html = await home.text();
    if (home.status !== 200 || !html.includes("data-intake-form")) {
      throw new Error(`intake homepage did not render its form (${home.status})`);
    }
    const submission = await fetch(`${origin}/api/intake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Cold Start",
        email: "cold-start@example.com",
        attendance: "yes",
        resultKey: "reserved",
        replyLocale: "en",
      }),
    });
    if (submission.status !== 200 || (await submission.json())?.ok !== true) {
      throw new Error(`intake submission returned ${submission.status}`);
    }
  });
  await smokeTyped("reservation", async (origin) => {
    await assertSeededHome(origin);
    await assertAgentSurface(origin);
    const home = await fetch(`${origin}/`);
    if (home.status !== 200 || !(await home.text()).includes("data-mantle-form")) {
      throw new Error(`reservation homepage did not render its form (${home.status})`);
    }
    const request = await fetch(`${origin}/api/reservation-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Cold Start",
        email: "cold-start@example.com",
        requestedFor: "2026-08-04T10:00:00.000Z",
        partySize: 2,
      }),
    });
    if (request.status !== 200 || (await request.json())?.ok !== true) {
      throw new Error(`reservation request returned ${request.status}`);
    }
  });
  console.log("blank + all typed starter runtime smoke passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

async function assertSeededHome(origin) {
  const first = await fetch(`${origin}/`);
  if (first.status !== 200 || !(await first.text()).includes("Runtime Smoke")) {
    throw new Error(`seeded homepage returned ${first.status}`);
  }
  const view = await fetch(`${origin}/api/views/home`);
  const body = await view.json();
  if (view.status !== 200 || !Array.isArray(body?.data?.rows) || body.data.rows.length !== 1) {
    throw new Error(`seeded home View returned ${view.status}: ${JSON.stringify(body)}`);
  }
}

async function assertAgentSurface(origin, routes = [], locales = ["en"]) {
  const home = await fetch(`${origin}/en`);
  const homeHtml = await home.text();
  assertPublicDocument(home, homeHtml, "/en", locales);

  const homeMarkdown = await fetch(`${origin}/en.md`);
  if (homeMarkdown.status !== 200 || !(await homeMarkdown.text()).trim()) {
    throw new Error(`home markdown returned ${homeMarkdown.status} or an empty body`);
  }

  const localeIndex = await fetch(`${origin}/en/llms.txt`);
  const localeIndexText = await localeIndex.text();
  if (localeIndex.status !== 200 || !localeIndexText.includes("/en.md")) {
    throw new Error(`locale llms.txt returned ${localeIndex.status} without the home markdown URL`);
  }

  const rootIndex = await fetch(`${origin}/llms.txt`);
  const rootIndexText = await rootIndex.text();
  if (rootIndex.status !== 200 || !rootIndexText.includes("/en.md")) {
    throw new Error(`root llms.txt returned ${rootIndex.status} without public markdown URLs`);
  }
  for (const locale of locales) {
    if (!rootIndexText.includes(`Locale: ${locale}`) || !rootIndexText.includes(`/${locale.toLowerCase()}.md`)) {
      throw new Error(`root llms.txt omitted ${locale}`);
    }
  }

  const sitemap = await fetch(`${origin}/sitemap.xml`);
  const sitemapText = await sitemap.text();
  if (sitemap.status !== 200 || !sitemapText.includes("/en</loc>")) {
    throw new Error(`sitemap returned ${sitemap.status} without the home URL`);
  }

  for (const { segment, slug } of routes) {
    const listPath = `/en/${segment}`;
    const list = await fetch(`${origin}${listPath}`);
    assertPublicDocument(list, await list.text(), listPath, locales);

    const listMarkdown = await fetch(`${origin}${listPath}.md`);
    const listMarkdownText = await listMarkdown.text();
    if (listMarkdown.status !== 200 || !listMarkdownText.includes(`${listPath}/${slug}.md`)) {
      throw new Error(`${listPath}.md returned ${listMarkdown.status} without its public entry URL`);
    }

    const entryPath = `${listPath}/${slug}`;
    const entry = await fetch(`${origin}${entryPath}`);
    assertPublicDocument(entry, await entry.text(), entryPath, locales);

    const markdown = await fetch(`${origin}${entryPath}.md`);
    if (markdown.status !== 200 || !(await markdown.text()).trim()) {
      throw new Error(`${entryPath}.md returned ${markdown.status} or an empty body`);
    }
    if (!localeIndexText.includes(`${entryPath}.md`)) {
      throw new Error(`llms.txt omitted ${entryPath}.md`);
    }
    if (!sitemapText.includes(`${entryPath}</loc>`) || !sitemapText.includes(`${listPath}</loc>`)) {
      throw new Error(`sitemap omitted ${listPath} or ${entryPath}`);
    }
  }

  const missing = await fetch(`${origin}/nope.md`);
  if (missing.status !== 404 || (await missing.text()).trim() !== "not found") {
    throw new Error(`missing markdown returned ${missing.status} instead of an explicit 404`);
  }

  const authenticated = await fetch(`${origin}/en`, { headers: { cookie: "session=smoke" } });
  if (authenticated.headers.get("cache-control") !== "private, no-store" || authenticated.headers.has("cache-tag")) {
    throw new Error("cookie-bearing public request was eligible for anonymous cache");
  }
}

function assertPublicDocument(response, html, path, locales) {
  if (response.status !== 200) throw new Error(`${path} returned ${response.status}`);
  if (!response.headers.get("cache-control")?.includes("s-maxage=300")) {
    throw new Error(`${path} is missing anonymous cache freshness`);
  }
  if (response.headers.get("cache-tag") !== "mantle-public") {
    throw new Error(`${path} is missing the site-level cache tag`);
  }
  for (const required of [
    'rel="canonical"',
    'rel="alternate" type="text/markdown"',
    'property="og:url"',
    'name="twitter:card"',
    'type="application/ld+json"',
    'hreflang="x-default"',
    `href="http://localhost:8787${path}"`,
  ]) {
    if (!html.includes(required)) throw new Error(`${path} head is missing ${required}`);
  }
  for (const locale of locales) {
    if (!html.includes(`hreflang="${locale}"`)) throw new Error(`${path} is missing hreflang ${locale}`);
  }
}

async function smokeBlank() {
  prepareProject(join(root, "blank"), "blank");
  await withWorker({
    cwd: join(root, "blank"),
    command: "pnpm",
    args: ["exec", "wrangler"],
    probe: "/api/views/published-notes",
    async check(origin) {
      const view = await fetch(`${origin}/api/views/published-notes`);
      const body = await view.json();
      if (view.status !== 200 || !Array.isArray(body?.data?.rows) || body.data.rows.length !== 0) {
        throw new Error(`blank View returned ${view.status}: ${JSON.stringify(body)}`);
      }
    },
  });

  await withWorker({
    cwd: join(root, "blank"),
    command: "pnpm",
    args: ["exec", "wrangler"],
    devArgs: [
      "--var", "MANTLE_AUTH_MODE:self-managed",
      "--var", "BETTER_AUTH_SECRET:runtime-smoke-auth-secret-at-least-thirty-two-bytes",
      "--var", "GITHUB_CLIENT_ID:runtime-smoke-github-client",
      "--var", "GITHUB_CLIENT_SECRET:runtime-smoke-github-secret",
      "--var", "ADMIN_GITHUB_LOGIN:runtime-smoke-owner",
    ],
    probe: "/api/auth/methods",
    setupIncomplete: false,
    async check(origin) {
      const response = await fetch(`${origin}/api/auth/methods`);
      if (response.status !== 200) throw new Error(`self-managed auth methods returned ${response.status}`);
      const body = await response.json();
      if (JSON.stringify(body) !== JSON.stringify({ methods: [{ kind: "social", provider: "github" }] })) {
        throw new Error(`unexpected self-managed auth methods: ${JSON.stringify(body)}`);
      }
    },
  });

  await withWorker({
    cwd: join(root, "blank"),
    command: "pnpm",
    args: ["exec", "wrangler"],
    devArgs: [
      "--var", "MANTLE_AUTH_MODE:self-managed",
      "--var", "BETTER_AUTH_SECRET:runtime-smoke-auth-secret-at-least-thirty-two-bytes",
      "--var", "GITHUB_CLIENT_ID:runtime-smoke-github-client",
      "--var", "GITHUB_CLIENT_SECRET:runtime-smoke-github-secret",
      "--var", "ADMIN_GITHUB_LOGIN:runtime-smoke-owner",
      "--var", "MANTLE_HOSTED_AUTH_ISSUER:http://localhost:8788",
    ],
    probe: "/_mantle/admin/index.html",
    async check(origin) {
      const response = await fetch(`${origin}/_mantle/admin/index.html`);
      const html = await response.text();
      const script = html.match(/src="([^"]+\.js)"/)?.[1];
      if (response.status !== 200 || !script || (await fetch(new URL(script, origin))).status !== 200) {
        throw new Error(`Admin static assets returned ${response.status}`);
      }
    },
  });
}

async function smokeTyped(archetype, check, replacementOverrides = {}) {
  const target = join(tempRoot, archetype);
  const state = mkdtempSync(join(tempRoot, "wrangler-"));
  const bundle = JSON.parse(readFileSync(join(root, "provision-bundles", `${archetype}.json`), "utf8"));
  materializeBundle(target, bundle, { ...replacements, ...replacementOverrides, ARCHETYPE: archetype });
  symlinkSync(join(root, "recipes", "typed-web", "node_modules"), join(target, "node_modules"), "dir");
  prepareProject(target, archetype);
  const mantle = join(root, "recipes", "typed-web", "node_modules", ".bin", "mantle");
  for (const args of [["validate", "--phase", "deploy"], ["generate", "--check"]]) {
    const result = spawnSync(mantle, args, { cwd: target, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${archetype} mantle ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  const typecheck = spawnSync(
    join(root, "recipes", "typed-web", "node_modules", ".bin", "tsc"),
    ["--noEmit", "-p", join(target, "tsconfig.json")],
    { encoding: "utf8" },
  );
  if (typecheck.status !== 0) throw new Error(`${archetype} typecheck failed: ${typecheck.stderr || typecheck.stdout}`);
  if (!check) return;
  await withWorker({
    cwd: target,
    command: join(root, "recipes", "typed-web", "node_modules", ".bin", "wrangler"),
    args: [],
    persistTo: state,
    probe: "/",
    async check(origin) {
      for (const path of ["/site-icon.svg", "/assets/styles.css"]) {
        if ((await fetch(`${origin}${path}`)).status !== 200) {
          throw new Error(`${archetype} static asset ${path} is unavailable`);
        }
      }
      await check(origin);
    },
  });
  if (archetype === "transaction") {
    const seedPath = join(target, ".mantle", "overlays", "transaction", "seed.json");
    const seed = JSON.parse(readFileSync(seedPath, "utf8"));
    seed.collections.products.push({ status: "invalid", slug: "must-not-run" });
    writeFileSync(seedPath, JSON.stringify(seed));
    await withWorker({
      cwd: target,
      command: join(root, "recipes", "typed-web", "node_modules", ".bin", "wrangler"),
      args: [],
      persistTo: state,
      probe: "/",
      async check(origin) {
        const home = await fetch(`${origin}/`);
        if (home.status !== 200 || !(await home.text()).includes("Sample product")) {
          throw new Error("transaction cold restart repeated its completed seed");
        }
      },
    });
  }
}

function prepareProject(target, archetype) {
  const result = spawnSync("pnpm", ["prepare"], { cwd: target, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${archetype} prepare failed: ${result.stderr || result.stdout}`);
}

async function withWorker({ cwd, command, args, devArgs = [], persistTo, probe, check, setupIncomplete = true }) {
  const state = persistTo ?? mkdtempSync(join(tempRoot, "wrangler-"));
  const port = await freePort();
  const child = spawn(command, [
    ...args,
    "dev",
    "--ip", "localhost",
    "--port", String(port),
    "--inspector-port", "0",
    "--persist-to", state,
    ...devArgs,
  ], {
    cwd,
    detached: process.platform !== "win32",
    env: { ...process.env, WRANGLER_HOME: state },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  try {
    const origin = `http://localhost:${port}`;
    await waitForWorker(`${origin}${probe}`, child);
    await check(origin);
    if (setupIncomplete) await assertPrivateSurfaces(origin);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`);
  } finally {
    stop(child);
  }
}

async function assertPrivateSurfaces(origin) {
  for (const path of ["/admin", "/mcp/staff"]) {
    const response = await fetch(`${origin}${path}`);
    if (response.status !== 503) throw new Error(`${path} returned ${response.status}; expected 503`);
    if (response.headers.get("cache-control") !== "private, no-store") {
      throw new Error(`${path} setup response is cacheable`);
    }
  }
}

async function waitForWorker(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`wrangler exited ${child.exitCode}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("wrangler did not become ready");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "localhost", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function stop(child) {
  if (child.exitCode !== null) return;
  try {
    if (process.platform === "win32") child.kill();
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill();
  }
}

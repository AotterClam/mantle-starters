#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
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
  for (const archetype of ["presence", "publication", "community"]) {
    await smokeTyped(archetype);
  }
  await smokeTyped("transaction", async (origin) => {
    const home = await fetch(`${origin}/`);
    const html = await home.text();
    if (home.status !== 200 || !["Runtime Smoke Starter", "Runtime Smoke Plus", "Runtime Smoke Complete"].every((text) => html.includes(text))) {
      throw new Error(`transaction homepage did not render its auth-free seed catalog (${home.status})`);
    }
    const view = await fetch(`${origin}/api/views/public-products`);
    const body = await view.json();
    if (view.status !== 200 || !Array.isArray(body?.data?.rows) || body.data.rows.length !== 0) {
      throw new Error(`transaction View returned ${view.status}: ${JSON.stringify(body)}`);
    }
  });
  await smokeTyped("intake", async (origin) => {
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
  console.log("blank + transaction + intake + reservation runtime smoke passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

async function smokeBlank() {
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
}

async function smokeTyped(archetype, check) {
  const target = join(tempRoot, archetype);
  const bundle = JSON.parse(readFileSync(join(root, "provision-bundles", `${archetype}.json`), "utf8"));
  materializeBundle(target, bundle, { ...replacements, ARCHETYPE: archetype });
  symlinkSync(join(root, "recipes", "typed-web", "node_modules"), join(target, "node_modules"), "dir");
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
    probe: "/",
    check,
  });
}

async function withWorker({ cwd, command, args, probe, check }) {
  const state = mkdtempSync(join(tempRoot, "wrangler-"));
  const port = await freePort();
  const child = spawn(command, [
    ...args,
    "dev",
    "--ip", "localhost",
    "--port", String(port),
    "--inspector-port", "0",
    "--persist-to", state,
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
    await assertPrivateSurfaces(origin);
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

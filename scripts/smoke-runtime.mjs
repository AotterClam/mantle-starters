#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { materializeBundle } from "./materialize-bundle.mjs";

const root = new URL("..", import.meta.url).pathname;
const execute = promisify(execFile);
const REQUEST_TIMEOUT_MS = 10_000;

await withWorker("blank", async ({ base }) => {
  const response = await timedFetch(`${base}/api/views/published-notes`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.data?.rows, []);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

await withWorker("transaction", async ({ base, queryD1, restart }) => {
  const valid = await post(base, "/api/product-inquiries", {
    productSlug: "first-product",
    email: "buyer@example.com",
  });
  assert.equal(valid.status, 200);
  const validBody = await valid.json();
  assert.equal(validBody.ok, true);
  assert.equal(validBody.data?.data?.productSlug, "first-product");

  for (const productSlug of ["---", "-product", "product--x"]) {
    const invalid = await post(base, "/api/product-inquiries", {
      productSlug,
      email: "buyer@example.com",
    });
    assert.equal(invalid.status, 400, `accepted malformed product slug ${productSlug}`);
    assert.equal((await invalid.json()).diagnostic?.code, "INPUT_VALIDATION_FAILED");
  }
  const invalidEmail = await post(base, "/api/product-inquiries", {
    productSlug: "first-product",
    email: "not-an-email",
  });
  assert.equal(invalidEmail.status, 400);

  const migrationsBefore = (await queryD1(
    "SELECT id FROM _migrations ORDER BY id",
  )).map(({ id }) => id);
  assert.ok(migrationsBefore.length > 0, "transaction boot applied no migrations");

  const restartedBase = await restart();
  const persisted = await queryD1(
    "SELECT COUNT(*) AS count FROM entries WHERE collection = 'product-inquiries'",
  );
  assert.equal(Number(persisted[0]?.count), 1, "first inquiry did not survive restart");
  const migrationsAfter = (await queryD1(
    "SELECT id FROM _migrations ORDER BY id",
  )).map(({ id }) => id);
  assert.deepEqual(migrationsAfter, migrationsBefore, "restart changed applied migrations");

  const replay = await post(restartedBase, "/api/product-inquiries", {
    productSlug: "second-product",
    email: "buyer@example.com",
  });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.ok, true);
  assert.equal(replayBody.data?.data?.productSlug, "second-product");
  const finalRows = await queryD1(
    "SELECT COUNT(*) AS count FROM entries WHERE collection = 'product-inquiries'",
  );
  assert.equal(Number(finalRows[0]?.count), 2);
});

await withWorker("presence", async ({ base, target }) => {
  const home = readFileSync(join(target, "public", "index.html"), "utf8");
  assert.match(home, /data-sitekey="runtime-public-key"/);
  const valid = await post(base, "/api/contact", {
    name: "Ada",
    email: "ada@example.com",
    message: "Hello",
  });
  assert.equal(valid.status, 200);
  const invalid = await post(base, "/api/contact", { name: "Ada", message: "Hello" });
  assert.equal(invalid.status, 400);
});

await withWorker("blank", async ({ base }) => {
  const page = await timedFetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-mantle-recipe="minimal-page-v1"/);

  const invoked = await post(base, "/api/custom-greeting", { name: "Ada" });
  assert.equal(invoked.status, 200);
  assert.equal(invoked.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await invoked.json(), {
    ok: true,
    data: {
      message: "Hello from an override, Ada",
      anonymous: true,
      envMatches: true,
    },
  });

  const status = await waitForJson(`${base}/api/custom-status`, (body) =>
    body.lastName === "Ada");
  assert.deepEqual(status, {
    ok: true,
    authBasePath: "/api/auth",
    greeting: "Hello from an override",
    lastName: "Ada",
    rows: 0,
  });

  const denied = await timedFetch(`${base}/api/custom-status?deny=1`);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("cache-control"), "private, no-store");
  const denial = await denied.json();
  assert.equal(denial.diagnostic?.code, "AUTH_DENIED");
  assert.equal("candidates" in denial.diagnostic, false);

  const publicResponse = await timedFetch(`${base}/custom-public`);
  assert.equal(publicResponse.headers.get("cache-control"), "public, s-maxage=60");
  assert.equal(publicResponse.headers.get("vary"), "Cookie, Authorization");
  const credentialed = await timedFetch(`${base}/custom-public`, {
    headers: { authorization: "Bearer fixture" },
  });
  assert.equal(credentialed.headers.get("cache-control"), "private, no-store");
}, {
  label: "blank-custom-logic",
  customize: installCustomLogicFixture,
  generate: true,
});

console.log("packed runtime smokes passed: blank, transaction, presence, blank + custom logic");

async function withWorker(archetype, verify, options = {}) {
  const bundle = JSON.parse(
    readFileSync(join(root, "provision-bundles", `${archetype}.json`), "utf8"),
  );
  const label = options.label ?? archetype;
  const target = mkdtempSync(join(tmpdir(), `mantle-runtime-${label}-`));
  const state = join(target, ".wrangler", "state");
  const logs = [];
  let worker;
  let failure;
  try {
    materializeBundle(target, bundle, replacements(archetype));
    const nodeModules = join(root, "blank", "node_modules");
    if (!existsSync(nodeModules)) throw new Error("blank/node_modules is required");
    symlinkSync(nodeModules, join(target, "node_modules"), "dir");
    options.customize?.(target);
    if (options.generate) await runProject(target, ["generate"]);
    await runProject(target, ["typecheck"]);
    worker = await startWorker(target, state, logs);
    await verify({
      base: worker.base,
      target,
      queryD1: (sql) => queryLocalD1(target, state, sql),
      restart: async () => {
        await worker.stop();
        worker = await startWorker(target, state, logs);
        return worker.base;
      },
    });
  } catch (error) {
    failure = error;
  } finally {
    try {
      await worker?.stop();
    } catch (error) {
      failure ??= error;
    }
    rmSync(target, { recursive: true, force: true });
  }
  if (failure) {
    throw new Error(
      `${label} runtime smoke failed: ${formatError(failure)}\nWrangler logs:\n${logs.join("")}`,
      { cause: failure },
    );
  }
}

async function startWorker(target, state, logs) {
  const port = await freePort();
  const child = spawn(
    "wrangler",
    [
      "dev",
      "--local",
      "--port",
      String(port),
      "--inspector-port",
      "0",
      "--persist-to",
      state,
    ],
    {
      cwd: target,
      env: {
        ...process.env,
        ...runtimeEnv(),
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  child.stdout.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr.on("data", (chunk) => logs.push(String(chunk)));
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await timedFetch(base, {}, 750);
      if (response.status > 0) {
        return {
          base,
          stop: () => stopWorker(child),
        };
      }
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stopWorker(child);
  throw new Error(`Wrangler failed to start ${target}:\n${logs.join("")}`);
}

async function stopWorker(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  signalProcessGroup(child, "SIGTERM");
  if (await exitsWithin(child, 3_000)) return;
  signalProcessGroup(child, "SIGKILL");
  if (!(await exitsWithin(child, 2_000))) {
    throw new Error(`Wrangler process ${child.pid ?? "unknown"} did not stop`);
  }
}

function signalProcessGroup(child, signal) {
  try {
    if (!child.pid) throw new Error("missing child pid");
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function exitsWithin(child, timeout) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeout);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no runtime smoke port");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

function post(base, path, body) {
  return timedFetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function timedFetch(input, init = {}, timeout = REQUEST_TIMEOUT_MS) {
  return fetch(input, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeout),
  });
}

async function waitForJson(url, accept) {
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await timedFetch(url);
    assert.equal(response.status, 200);
    const body = await response.json();
    if (accept(body)) return body;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function runProject(target, args) {
  try {
    await execute("pnpm", args, {
      cwd: target,
      env: { ...process.env, ...runtimeEnv() },
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`pnpm ${args.join(" ")} failed:\n${formatError(error)}`, { cause: error });
  }
}

async function queryLocalD1(target, state, sql) {
  const { stdout } = await execute("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    state,
    "--command",
    sql,
    "--json",
  ], {
    cwd: target,
    env: { ...process.env, ...runtimeEnv() },
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const result = JSON.parse(stdout);
  return (Array.isArray(result) ? result[0] : result)?.results ?? [];
}

function runtimeEnv() {
  return {
    PATH: [
      join(root, "blank", "node_modules", ".bin"),
      process.env.PATH ?? "",
    ].join(delimiter),
  };
}

function formatError(error) {
  if (!(error instanceof Error)) return String(error);
  const output = [error.message, error.stdout, error.stderr].filter(Boolean).join("\n");
  return output || String(error);
}

function installCustomLogicFixture(target) {
  const manifestPath = join(target, "manifests", "custom-greeting.yaml");
  writeFileSync(manifestPath, `apiVersion: cms.mantle.aotter.net/v1
kind: Procedure
metadata:
  name: custom-greeting
spec:
  input:
    type: object
    additionalProperties: false
    required: [name]
    properties:
      name: { type: string, minLength: 1 }
  output:
    type: object
    additionalProperties: false
    required: [message, anonymous, envMatches]
    properties:
      message: { type: string }
      anonymous: { type: boolean }
      envMatches: { type: boolean }
  handler:
    kind: ref
    ref: custom-greeting
---
apiVersion: cms.mantle.aotter.net/v1
kind: Trigger
metadata:
  name: custom-greeting-http
spec:
  source:
    kind: http
    method: POST
    path: /api/custom-greeting
  target:
    procedure: custom-greeting
`);

  const configPath = join(target, "wrangler.jsonc");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.vars.CUSTOM_GREETING = "Hello from an override";
  config.assets = { directory: "./public" };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  mkdirSync(join(target, "public"), { recursive: true });
  copyFileSync(
    join(root, "recipes", "minimal-page.html"),
    join(target, "public", "index.html"),
  );

  writeFileSync(join(target, "src", "greeting.ts"), `import type { MantleHandlers } from "../.mantle/generated/types.js";

export function createCustomHandlers(env: Env): MantleHandlers<Env> {
  return {
    "custom-greeting": async (input, ctx) => {
      if (!ctx.waitUntil) throw new Error("waitUntil is required in a Worker");
      ctx.waitUntil(ctx.env.KV.put("custom:last-name", input.name));
      return {
        message: \`${"${ctx.env.CUSTOM_GREETING}"}, ${"${input.name}"}\`,
        anonymous: ctx.user === null && ctx.staff === null && ctx.auth === undefined,
        envMatches: ctx.env.CUSTOM_GREETING === env.CUSTOM_GREETING,
      };
    },
  };
}
`);

  writeFileSync(join(target, "src", "index.ts"), `import {
  createMantleWorker,
  runMantleUseCase,
} from "@aotter/mantle/cloudflare";
import { runtimeDiagnostic } from "@aotter/mantle/spec";
import { bindMantleSite, manifest } from "../.mantle/generated/site.js";
import { createCustomHandlers } from "./greeting.js";

export default createMantleWorker<Env>({
  manifest,
  extend: ({ env }) => ({
    handlers: createCustomHandlers(env),
    mount: ({ app, auth, getRuntime }) => {
      app.get("/api/custom-status", async (c) => runMantleUseCase(
        "GET /api/custom-status",
        async () => {
          if (c.req.query("deny") === "1") {
            return {
              ok: false as const,
              diagnostic: runtimeDiagnostic({
                code: "AUTH_DENIED",
                severity: "error",
                path: "custom/status",
                candidates: ["private-role"],
                message: "Access denied.",
              }),
            };
          }
          const notes = await bindMantleSite(await getRuntime()).views["published-notes"]();
          if (!notes.ok) return notes;
          return {
            ok: true,
            authBasePath: auth.basePath,
            greeting: c.env.CUSTOM_GREETING,
            lastName: await c.env.KV.get("custom:last-name"),
            rows: notes.result.rows.length,
          };
        },
      ));
      app.get("/custom-public", (c) => new Response(c.env.CUSTOM_GREETING, {
        headers: { "cache-control": "public, s-maxage=60" },
      }));
    },
  }),
});
`);
}

function replacements(archetype) {
  return {
    PROJECT_NAME: `runtime-${archetype}`,
    ARCHETYPE: archetype,
    AUTH_MODE: "self-managed",
    BRAND: "Runtime Smoke",
    DESCRIPTION: `${archetype} packed runtime smoke.`,
    INSTALL_SUMMARY: "Packed Core runtime validation.",
    LOCALES: '["en"]',
    CANONICAL_LOCALE: "en",
    STARTER_REF: "packed-under-test",
    GITHUB_OWNER: "aotter",
    ADMIN_GITHUB_LOGIN: "aotter",
    SITE_OWNER_EMAIL: "owner@example.com",
    SITE_URL: "http://127.0.0.1",
    TURNSTILE_SITE_KEY: "runtime-public-key",
    AFTER_LAUNCH_SKILL_URL: "https://mantle.tools/skill/after-launch?id=runtime",
    INSTALL_TIMESTAMP: "2026-01-01T00:00:00.000Z",
  };
}

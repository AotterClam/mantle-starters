#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const state = mkdtempSync(join(tmpdir(), "mantle-blank-smoke-"));
const port = await freePort();

const child = spawn("pnpm", [
  "-C",
  "blank",
  "exec",
  "wrangler",
  "dev",
  "--ip",
  "localhost",
  "--port",
  String(port),
  "--inspector-port",
  "0",
  "--persist-to",
  state,
], {
  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, WRANGLER_HOME: state },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

try {
  await waitForWorker(port, child);
  const view = await fetch(`http://localhost:${port}/api/views/published-notes`);
  if (view.status !== 200) throw new Error(`public View returned ${view.status}`);
  const body = await view.json();
  if (!Array.isArray(body?.data?.rows) || body.data.rows.length !== 0) {
    throw new Error(`empty D1 View returned ${JSON.stringify(body)}`);
  }
  for (const path of ["/admin", "/mcp/staff"]) {
    const response = await fetch(`http://localhost:${port}${path}`);
    if (response.status !== 503) throw new Error(`${path} returned ${response.status}; expected 503`);
    if (response.headers.get("cache-control") !== "private, no-store") {
      throw new Error(`${path} setup response is cacheable`);
    }
  }
  console.log("headless blank smoke passed");
} catch (error) {
  throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`);
} finally {
  stop(child);
  rmSync(state, { recursive: true, force: true });
}

async function waitForWorker(port, process) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`wrangler exited ${process.exitCode}`);
    try {
      await fetch(`http://localhost:${port}/api/views/published-notes`);
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

function stop(childProcess) {
  if (childProcess.exitCode !== null) return;
  try {
    if (globalThis.process.platform === "win32") childProcess.kill();
    else globalThis.process.kill(-childProcess.pid, "SIGTERM");
  } catch {
    childProcess.kill();
  }
}

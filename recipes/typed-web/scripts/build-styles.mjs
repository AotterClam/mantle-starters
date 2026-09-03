#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "tailwindcss";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const rootArg = valueAfter("--root") ?? ".";
const root = resolve(rootArg);
const inputPath = join(root, "styles", "globals.css");
const require = createRequire(import.meta.url);

const compiler = await compile(readFileSync(inputPath, "utf8"), {
  from: inputPath,
  loadStylesheet: async (id, base) => {
    const path =
      id === "tailwindcss"
        ? require.resolve("tailwindcss/index.css", { paths: [root] })
        : id === "./swirl-images.css"
          ? join(root, "styles", "swirl-images.css")
        : resolveStylesheet(id, base);
    return {
      base: dirname(path),
      content: readFileSync(path, "utf8"),
    };
  },
});

const css = compiler.build(collectCandidates(root));
const browserAssets = await compileBrowserAssets(root);
const outputs = new Map([
  ["assets/styles.css", css],
  ["assets/kiwa-home.js", browserAssets.homeClientJs],
  ["assets/mantle-webmcp.js", readFileSync(new URL(import.meta.resolve("@aotter/mantle-web/webmcp")), "utf8").replace(/\n\/\/# sourceMappingURL=.*\n?$/u, "\n")],
  ["assets/mantle-ocean-hero-light.svg", browserAssets.mantleOceanHeroLightSvg],
  ["assets/mantle-ocean-hero-dark.svg", browserAssets.mantleOceanHeroDarkSvg],
  ...Object.entries(browserAssets.kiwaEnhanceAssets).map(([name, source]) => [`enhance/${name}`, source]),
]);

if (checkOnly) {
  const stale = [...outputs].some(([path, expected]) => {
    const output = join(root, "public", path);
    return !existsSync(output) || readFileSync(output, "utf8") !== expected;
  });
  if (stale) {
    console.error("generated static assets are stale; run node scripts/build-styles.mjs");
    process.exit(1);
  }
} else {
  for (const [path, source] of outputs) {
    const output = join(root, "public", path);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, source);
  }
}

async function compileBrowserAssets(root) {
  const output = mkdtempSync(join(tmpdir(), "mantle-browser-assets-"));
  try {
    const tsc = require.resolve("typescript/lib/tsc.js", { paths: [root] });
    const homeClientPath = join(root, "src", "web", "client", "homeClient.ts");
    const enhanceEnabled = readFileSync(homeClientPath, "utf8").includes("enhanceClientJs");
    const sources = [
      homeClientPath,
      ...(enhanceEnabled ? [join(root, "src", "web", "client", "kiwaEnhanceAssets.ts")] : []),
      join(root, "src", "web", "mantleOceanHero.ts"),
    ];
    const result = spawnSync(process.execPath, [
      tsc,
      "--ignoreConfig",
      "--pretty", "false",
      "--target", "ES2022",
      "--module", "ESNext",
      "--moduleResolution", "Bundler",
      "--skipLibCheck",
      "--rootDir", join(root, "src"),
      "--outDir", output,
      ...sources,
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || "browser asset compile failed");
    const [home, enhance, hero] = await Promise.all([
      import(pathToFileURL(join(output, "web", "client", "homeClient.js")).href),
      enhanceEnabled
        ? import(pathToFileURL(join(output, "web", "client", "kiwaEnhanceAssets.js")).href)
        : Promise.resolve({ kiwaEnhanceAssets: {} }),
      import(pathToFileURL(join(output, "web", "mantleOceanHero.js")).href),
    ]);
    return {
      homeClientJs: home.homeClientJs,
      kiwaEnhanceAssets: enhance.kiwaEnhanceAssets,
      mantleOceanHeroLightSvg: hero.mantleOceanHeroLightSvg,
      mantleOceanHeroDarkSvg: hero.mantleOceanHeroDarkSvg,
    };
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
}

function resolveStylesheet(id, base) {
  const baseDir = base ? (extname(base) ? dirname(base) : base) : root;
  if (id.startsWith(".")) return resolve(baseDir, id);
  return require.resolve(id, { paths: [baseDir] });
}

function collectCandidates(root) {
  const candidates = new Set();
  const ignored = new Set([
    join(root, "src", "mantle", "config.ts"),
    join(root, "src", "web", "content", "siteContent.ts"),
    join(root, "src", "web", "mantleOceanHero.ts"),
  ]);
  for (const dir of ["src", "components"]) {
    collectFromDir(join(root, dir), candidates, ignored);
  }
  return [...candidates].sort();
}

function collectFromDir(dir, candidates, ignored) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) {
      collectFromDir(path, candidates, ignored);
      continue;
    }
    // Provisioned site copy is data, even when it happens to spell a utility.
    if (ignored.has(path)) continue;
    if (![".js", ".jsx", ".ts", ".tsx"].includes(extname(name.name))) continue;
    for (const token of readFileSync(path, "utf8").match(/[A-Za-z0-9_!:[\]./%#(),=>*+-]+/g) ?? []) {
      candidates.add(token);
    }
  }
}

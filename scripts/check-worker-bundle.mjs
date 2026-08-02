#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const path = join(root, "blank", ".wrangler", "dry-run", "index.js");
const source = readFileSync(path, "utf8");

for (const marker of ["yaml/browser", "parse/lexer.js", "parseAllDocuments"]) {
  if (source.includes(marker)) {
    throw new Error(`generated Worker still contains the YAML parser marker: ${marker}`);
  }
}

console.log(`Worker bundle is parser-free (${Buffer.byteLength(source)} bytes)`);

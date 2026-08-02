import {
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export function materializeBundle(root, bundle, values) {
  const normalizedValues = {
    ...values,
    LOCALES: normalizeLocales(values.LOCALES),
  };
  for (const [path, raw] of Object.entries(bundle.files ?? {})) {
    const target = safeTarget(root, path.replace(/\.template$/, ""));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      substitute(String(raw), substitutionValues(path, normalizedValues)),
      "utf8",
    );
  }
}

function safeTarget(root, path) {
  const target = resolve(root, path);
  const fromRoot = relative(resolve(root), target);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`bundle path escapes project root: ${path}`);
  }
  return target;
}

function normalizeLocales(raw) {
  let locales;
  try {
    locales = JSON.parse(String(raw));
  } catch {
    throw new Error("LOCALES must be a JSON array of locale strings");
  }
  if (
    !Array.isArray(locales)
    || locales.length === 0
    || locales.some((locale) => typeof locale !== "string" || !locale.trim())
  ) {
    throw new Error("LOCALES must be a non-empty JSON array of locale strings");
  }
  return JSON.stringify(locales);
}

function substitutionValues(path, values) {
  const target = path.replace(/\.template$/, "");
  if (target.endsWith(".html")) return htmlValues(values);
  if (target.endsWith(".json") || target.endsWith(".jsonc") || target === "package.json") {
    return jsonValues(values);
  }
  return values;
}

function jsonValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    key === "LOCALES" ? value : JSON.stringify(String(value)).slice(1, -1),
  ]));
}

function htmlValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value)]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function substitute(text, values) {
  return text.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, key) => {
    if (key in values) return values[key];
    throw new Error(`Unknown placeholder ${match}`);
  });
}

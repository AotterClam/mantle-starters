import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isMap, isSeq, parseAllDocuments } from "yaml";

export function materializeBundle(root, bundle, values) {
  const locales = selectedLocales(values);
  const localizedSeed = `.mantle/overlays/${bundle.archetype}/seed.json`;
  const unsupported = bundle.archetype === "blank" || bundle.localizedFiles?.includes(localizedSeed)
    ? []
    : locales.filter((locale) => locale !== "en");
  if (unsupported.length) {
    throw new Error(`${bundle.archetype} does not support locales: ${unsupported.join(", ")}`);
  }
  for (const [path, raw] of Object.entries(bundle.files ?? {})) {
    const target = join(root, path.replace(/\.template$/, ""));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, substitute(String(raw), values), "utf8");
  }
  selectLocalizedFiles(root, bundle.localizedFiles ?? [], locales);
  selectManifestLocales(root, locales);
  applyProjectIdentity(root, values.PROJECT_NAME, values.SITE_URL);
}

function selectedLocales(values) {
  const locales = JSON.parse(values.LOCALES);
  if (!Array.isArray(locales) || locales.some((locale) => typeof locale !== "string")) {
    throw new Error("LOCALES must be a JSON string array");
  }
  if (!locales.includes(values.CANONICAL_LOCALE)) {
    throw new Error("CANONICAL_LOCALE must be included in LOCALES");
  }
  return locales;
}

function selectLocalizedFiles(root, paths, locales) {
  if (paths.length === 0) return;
  for (const path of paths) {
    const target = join(root, path.replace(/\.template$/, ""));
    const value = JSON.parse(readFileSync(target, "utf8"));
    const available = value?.locales;
    if (!available || typeof available !== "object" || Array.isArray(available)) {
      throw new Error(`${path} must expose an object at locales`);
    }
    const missing = locales.filter((locale) => !(locale in available));
    if (missing.length > 0) throw new Error(`${path} does not support locales: ${missing.join(", ")}`);
    value.locales = Object.fromEntries(locales.map((locale) => [locale, available[locale]]));
    writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}

function selectManifestLocales(root, locales) {
  const path = join(root, "manifests", "site.yaml");
  if (!existsSync(path)) return;
  const documents = parseAllDocuments(readFileSync(path, "utf8"));
  let changed = false;
  for (const document of documents) changed = trimLocalizedText(document.contents, locales, path) || changed;
  if (changed) writeFileSync(path, `${documents.map(String).join("---\n")}`, "utf8");
}

function trimLocalizedText(node, locales, path) {
  if (isSeq(node)) {
    let changed = false;
    for (const item of node.items) changed = trimLocalizedText(item, locales, path) || changed;
    return changed;
  }
  if (!isMap(node)) return false;
  let changed = false;
  for (const pair of node.items) {
    const key = String(pair.key?.value ?? "");
    if ((key === "title" || key === "description") && isLocalizedTextMap(pair.value)) {
      const available = new Set(pair.value.items.map((item) => String(item.key?.value ?? "")));
      const missing = locales.filter((locale) => !available.has(locale));
      if (missing.length > 0) throw new Error(`${path} does not support manifest locales: ${missing.join(", ")}`);
      const before = pair.value.items.length;
      pair.value.items = pair.value.items.filter((item) => locales.includes(String(item.key?.value ?? "")));
      changed ||= pair.value.items.length !== before;
    } else {
      changed = trimLocalizedText(pair.value, locales, path) || changed;
    }
  }
  return changed;
}

function isLocalizedTextMap(node) {
  return isMap(node)
    && node.items.some((item) => item.key?.value === "en")
    && node.items.every((item) => typeof item.value?.value === "string");
}

function substitute(text, values) {
  return text.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, key) => {
    if (key in values) return values[key];
    throw new Error(`Unknown placeholder ${match}`);
  });
}

function applyProjectIdentity(root, projectName, siteUrl) {
  const path = join(root, "wrangler.toml");
  if (!existsSync(path)) return;
  let text = readFileSync(path, "utf8")
    .replace(/^name = ".*"$/m, `name = ${JSON.stringify(projectName)}`)
    .replace(/^database_name = ".*"$/m, `database_name = ${JSON.stringify(`${projectName}-db`)}`);
  text = upsertWranglerStringVar(text, "PUBLIC_ORIGIN", siteUrl);
  writeFileSync(path, text, "utf8");
}

function upsertWranglerStringVar(text, name, value) {
  const line = `${name} = ${JSON.stringify(value)}`;
  const existing = new RegExp(`^\\s*#?\\s*${name}\\s*=.*$`, "m");
  if (existing.test(text)) return text.replace(existing, line);
  const vars = text.match(/^\[vars\]\s*$/m);
  if (!vars || vars.index === undefined) return `${text.trimEnd()}\n\n[vars]\n${line}\n`;
  const insertAt = vars.index + vars[0].length;
  return `${text.slice(0, insertAt)}\n${line}${text.slice(insertAt)}`;
}

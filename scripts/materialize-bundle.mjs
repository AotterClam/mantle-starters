import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function materializeBundle(root, bundle, values) {
  for (const [path, raw] of Object.entries(bundle.files ?? {})) {
    const target = join(root, path.replace(/\.template$/, ""));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, substitute(String(raw), values), "utf8");
  }
  selectLocalizedFiles(root, bundle.localizedFiles ?? [], values);
  applyProjectIdentity(root, values.PROJECT_NAME, values.SITE_URL);
}

function selectLocalizedFiles(root, paths, values) {
  if (paths.length === 0) return;
  const locales = JSON.parse(values.LOCALES);
  if (!Array.isArray(locales) || locales.some((locale) => typeof locale !== "string")) {
    throw new Error("LOCALES must be a JSON string array");
  }
  if (!locales.includes(values.CANONICAL_LOCALE)) {
    throw new Error("CANONICAL_LOCALE must be included in LOCALES");
  }
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

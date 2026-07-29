import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export function materializeBundle(root, bundle, values) {
  for (const [path, raw] of Object.entries(bundle.files ?? {})) {
    const target = join(root, path.replace(/\.template$/, ""));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, substitute(String(raw), values), "utf8");
  }
  applyProjectIdentity(root, values.PROJECT_NAME, values.SITE_URL);
}

export function substitute(text, values) {
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

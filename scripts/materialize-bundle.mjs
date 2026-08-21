import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderProvisionBundle } from "@aotter/mantle/provision";

export function materializeBundle(root, bundle, values) {
  const rendered = renderProvisionBundle({
    bundle,
    launch: {
      archetype: values.ARCHETYPE,
      projectName: values.PROJECT_NAME,
      brand: values.BRAND,
      description: values.DESCRIPTION,
      locales: JSON.parse(values.LOCALES),
      canonicalLocale: values.CANONICAL_LOCALE,
      authMode: values.AUTH_MODE,
      starterRef: values.STARTER_REF,
      installTimestamp: values.INSTALL_TIMESTAMP,
      siteUrl: values.SITE_URL,
      githubOwner: values.GITHUB_OWNER,
      adminGithubLogin: values.ADMIN_GITHUB_LOGIN,
      afterLaunchSkillUrl: values.AFTER_LAUNCH_SKILL_URL,
      installSummary: values.INSTALL_SUMMARY,
      turnstileSiteKey: values.TURNSTILE_SITE_KEY,
    },
  });

  const files = new Map(rendered.files);
  const wrangler = files.get("wrangler.toml");
  if (wrangler) files.set("wrangler.toml", upsertWranglerVar(wrangler, "PUBLIC_ORIGIN", values.SITE_URL));
  for (const [path, content] of files) write(root, path, content);
  for (const [path, content] of rendered.binaryFiles) write(root, path, Buffer.from(content, "base64"));
}

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function upsertWranglerVar(text, name, value) {
  const line = `${name} = ${JSON.stringify(value)}`;
  const existing = new RegExp(`^\\s*#?\\s*${name}\\s*=.*$`, "m");
  if (existing.test(text)) return text.replace(existing, () => line);
  const vars = text.match(/^\[vars\]\s*$/m);
  if (!vars || vars.index === undefined) return `${text.trimEnd()}\n\n[vars]\n${line}\n`;
  const insertAt = vars.index + vars[0].length;
  return `${text.slice(0, insertAt)}\n${line}${text.slice(insertAt)}`;
}

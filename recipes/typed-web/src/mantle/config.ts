import type { MantleCloudflareEnv } from "@aotter/mantle/cloudflare";
import type { SiteDefaults } from "@aotter/mantle/spec";

export interface Env extends MantleCloudflareEnv {
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
}

export function buildSiteDefaults(env: Env): SiteDefaults {
  return {
    brand: "{{BRAND}}",
    title: "{{BRAND}}",
    description: "{{DESCRIPTION}}",
    origin: env.PUBLIC_ORIGIN ?? "http://localhost:8787",
    locales: parseLocales(),
  };
}

function parseLocales(): readonly string[] {
  const raw = '{{LOCALES}}';
  return raw.startsWith('{{') ? ['en'] : JSON.parse(raw);
}

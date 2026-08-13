import type { SiteDefaults } from "@aotter/mantle/spec";
import type { MantleSiteAuthEnv } from "../auth.js";

export interface Env extends MantleSiteAuthEnv {
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
    icons: [{ src: "/site-icon.svg", mimeType: "image/svg+xml", sizes: ["any"] }],
  };
}

function parseLocales(): readonly string[] {
  const raw = '{{LOCALES}}';
  return raw.startsWith('{{') ? ['en'] : JSON.parse(raw);
}

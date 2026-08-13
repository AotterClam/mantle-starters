import type { SiteDefaults } from "@aotter/mantle/spec";
import type { MantleSiteAuthEnv } from "../auth.js";
import type { InventoryCoordinator } from "../commerce/InventoryCoordinator.js";

export interface Env extends MantleSiteAuthEnv {
  readonly TURNSTILE_SITE_KEY?: string;
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly INVENTORY_COORDINATOR: DurableObjectNamespace<InventoryCoordinator>;
  readonly ORDER_EXPIRY_QUEUE: Queue<{ readonly type: "expire-order"; readonly orderToken: string }>;
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

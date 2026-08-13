import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import type { Env } from "../mantle/config.js";
import { mountCommerceRoutes } from "./commerceRoutes.js";

export function mountTypeRoutes(
  app: MantleExtensionApp<Env>,
  getRuntime: () => Promise<CmsRuntime>,
): void {
  mountCommerceRoutes(app, getRuntime);
}

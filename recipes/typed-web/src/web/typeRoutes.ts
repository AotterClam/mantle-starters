import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import type { Env } from "../mantle/config.js";

export function mountTypeRoutes(
  _app: MantleExtensionApp<Env>,
  _getRuntime: () => Promise<CmsRuntime>,
): void {}

import type { CmsRuntime } from "@aotter/mantle/runtime";
import type { HomeContent } from "./types.js";

export async function resolveHomeContent(
  _getRuntime: () => Promise<CmsRuntime>,
  _locale?: string,
): Promise<HomeContent> {
  return { sections: [] };
}

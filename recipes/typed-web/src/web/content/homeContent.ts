import type { MantleRuntime } from "@aotter/mantle/runtime";
import type { HomeContent } from "./types.js";

export async function resolveHomeContent(
  _getRuntime: () => Promise<MantleRuntime>,
  _locale?: string,
): Promise<HomeContent> {
  return { sections: [] };
}

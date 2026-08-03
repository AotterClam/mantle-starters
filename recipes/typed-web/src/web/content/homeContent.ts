import type { CmsRuntime } from "@aotter/mantle/runtime";
import type { HomeContent } from "./types.js";

export const homeContent: HomeContent = {
  sections: [],
};

export const homeLocale: string | undefined = undefined;

export async function resolveHomeContent(
  _getRuntime: () => Promise<CmsRuntime>,
): Promise<HomeContent> {
  return homeContent;
}

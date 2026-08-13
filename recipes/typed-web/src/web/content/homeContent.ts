import type { CmsRuntime } from "@aotter/mantle/runtime";
import type { HomeContent } from "./types.js";

export const homeContent: HomeContent = {
  sections: [],
};

export const homeLocale: string | undefined = undefined;

export async function resolveHomeContent(
  _getRuntime: () => Promise<CmsRuntime>,
  _locale = homeLocale,
): Promise<HomeContent> {
  return homeContent;
}

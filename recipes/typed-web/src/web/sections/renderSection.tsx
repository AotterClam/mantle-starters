import type { Child } from "hono/jsx";
import type { HomeSection } from "../content/types.js";
import { sectionRenderers } from "./sectionRegistry.js";

export type SectionRenderer = (
  section: HomeSection,
  index: number,
  turnstileSiteKey?: string,
  locale?: string,
) => Child;

export function renderSection(
  section: HomeSection,
  index: number,
  turnstileSiteKey?: string,
  locale?: string,
): Child {
  return sectionRenderers[section.type]?.(section, index, turnstileSiteKey, locale);
}

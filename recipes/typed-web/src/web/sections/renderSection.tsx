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
  const localized = locale ? {
    ...section,
    action: localizeAction(section.action, locale),
    secondaryAction: localizeAction(section.secondaryAction, locale),
    footerAction: localizeAction(section.footerAction, locale),
    items: section.items?.map((item) => ({ ...item, href: localizeHref(item.href, locale) })),
  } : section;
  return sectionRenderers[section.type]?.(localized, index, turnstileSiteKey, locale);
}

function localizeAction(action: HomeSection["action"], locale: string) {
  return action && { ...action, href: localizeHref(action.href, locale) ?? action.href };
}

function localizeHref(href: string | undefined, locale: string): string | undefined {
  if (!href?.startsWith("/") || href.startsWith("//")) return href;
  const prefix = `/${locale.toLowerCase()}`;
  return href === prefix || href.startsWith(`${prefix}/`) ? href : `${prefix}${href}`;
}

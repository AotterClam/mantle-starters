import type { SiteContent } from "./types.js";

export const siteContent: SiteContent = {
  brand: "{{BRAND}}",
  description: "{{DESCRIPTION}}".trim(),
  navLinks: [],
  chromeLabels: {
    openNavigation: "Open navigation",
    closeNavigation: "Close navigation",
    navigation: "Navigation",
    toggleTheme: "Toggle color theme",
    lightMode: "Light mode",
    darkMode: "Dark mode",
  },
  footer: {
    columns: [],
    socialLinks: [],
    bottomLinks: [],
  },
};

export function siteContentForLocale(_locale: string): SiteContent {
  return siteContent;
}

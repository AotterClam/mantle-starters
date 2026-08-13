import seed from "../../../.mantle/overlays/transaction/seed.json";
import { messagesForLocale } from "../messages.js";
import type { SiteContent } from "./types.js";

export function siteContentForLocale(locale: string): SiteContent {
  const message = messagesForLocale(locale);
  return {
    brand: seed.site.brand,
    description: seed.site.description,
    navLinks: [
      { label: message["nav.products"], href: "/products" },
      { label: message["nav.about"], href: "/pages/about" },
    ],
    navAction: { label: message["nav.cart"], href: "/cart", icon: "cart" },
    chromeLabels: {
      openNavigation: message["chrome.openNavigation"],
      closeNavigation: message["chrome.closeNavigation"],
      navigation: message["chrome.navigation"],
      toggleTheme: message["chrome.toggleTheme"],
      lightMode: message["chrome.lightMode"],
      darkMode: message["chrome.darkMode"],
      language: message["chrome.language"],
    },
    footer: {
      copyright: `© ${seed.site.brand}`,
      columns: [],
      socialLinks: [],
      bottomLinks: [{ label: message["footer.builtWith"], href: "https://github.com/aotter/mantle" }],
    },
  };
}

export const siteContent = siteContentForLocale(seed.canonicalLocale);

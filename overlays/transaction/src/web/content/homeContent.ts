import type { CmsRuntime } from "@aotter/mantle/runtime";
import { bindMantleSite } from "../../../.mantle/generated/site.js";
import type { MantleSite } from "../../../.mantle/generated/types.js";
import seed from "../../../.mantle/overlays/transaction/seed.json";
import type { HomeContent, HomeItem, HomeSection } from "./types.js";

type SeedPage = { readonly type?: string; readonly sections?: readonly HomeSection[] };
type Product = (typeof seed.collections.products)[number] | MantleSite.ViewRow_public_products;

const seedPages = seed.collections.page as unknown as readonly SeedPage[];
const homePage = seedPages.find((page) => page.type === "home");
export const homeContent: HomeContent = { sections: homePage?.sections ?? [] };
export const homeLocale = seed.locale;

export async function resolveHomeContent(getRuntime: () => Promise<CmsRuntime>): Promise<HomeContent> {
  const result = await bindMantleSite(await getRuntime()).views["public-products"]();
  if (!result.ok) console.warn("Mantle public-products View failed; showing seed catalog", result.diagnostic);
  const products = result.ok && result.result.rows.length > 0
    ? result.result.rows
    : seed.collections.products;
  return {
    sections: homeContent.sections.map((section) => section.id === "products"
      ? { ...section, items: products.map(productItem) }
      : section),
  };
}

function productItem(product: Product): HomeItem {
  const price = product.currency && product.priceMinor !== undefined
    ? new Intl.NumberFormat(homeLocale, {
        style: "currency",
        currency: product.currency,
      }).format(product.priceMinor / 100)
    : "";
  return {
    icon: "sparkles",
    title: product.title,
    body: [product.summary, price].filter(Boolean).join(" · "),
  };
}

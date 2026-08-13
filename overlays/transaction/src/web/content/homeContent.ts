import { DiagnosticError } from "@aotter/mantle/spec";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import { bindMantleSite } from "../../../.mantle/generated/site.js";
import { messagesForLocale } from "../messages.js";
import type { HomeContent, HomeItem, HomeSection } from "./types.js";

type Product = {
  readonly slug: string;
  readonly title: string;
  readonly summary?: string;
  readonly priceMinor?: number;
  readonly currency?: string;
};

export async function resolveHomeContent(
  getRuntime: () => Promise<CmsRuntime>,
  locale: string,
): Promise<HomeContent> {
  const runtime = await getRuntime();
  const site = bindMantleSite(runtime);
  const [pageResult, productResult] = await Promise.all([
    site.views["home"]({ params: { locale } }),
    site.views["public-products"]({ params: { locale } }),
  ]);
  if (!pageResult.ok) throw new DiagnosticError(pageResult.diagnostic);
  if (!productResult.ok) throw new DiagnosticError(productResult.diagnostic);

  const sections = pageResult.result.rows[0]?.sections as readonly HomeSection[] | undefined;
  const translations = productResult.result.rows;
  const parents = translations.length > 0
    ? await runtime.entryReader.readByDataFieldIn({
        collection: "products",
        field: "slug",
        values: translations
          .map((product) => product.slug)
          .filter((slug): slug is string => typeof slug === "string"),
        status: "published",
      })
    : [];
  const parentBySlug = new Map(parents.map((entry) => [entry.data["slug"], entry.data]));
  const products: readonly Product[] = translations.map((translation) => ({
    ...parentBySlug.get(translation.slug ?? ""),
    ...translation,
  } as Product));
  const productSection: HomeSection = {
    type: "features",
    id: "products",
    title: messagesForLocale(locale)["nav.products"],
    items: products.map((product) => productItem(product, locale)),
  };
  const pageSections = sections ?? [];

  return {
    sections: pageSections.some((section) => section.id === "products")
      ? pageSections.map((section) => section.id === "products" ? { ...section, ...productSection } : section)
      : [...pageSections, productSection],
  };
}

function productItem(product: Product, locale: string): HomeItem {
  const price = product.currency && product.priceMinor !== undefined
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: product.currency,
      }).format(product.priceMinor / 100)
    : "";
  return {
    icon: "sparkles",
    title: product.title,
    body: [product.summary, price].filter(Boolean).join(" · "),
    href: `/${locale.toLowerCase()}/products/${product.slug}`,
  };
}

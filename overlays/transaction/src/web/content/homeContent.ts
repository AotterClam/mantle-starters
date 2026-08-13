import type { CmsRuntime } from "@aotter/mantle/runtime";
import { bindMantleSite } from "../../../.mantle/generated/site.js";
import seed from "../../../.mantle/overlays/transaction/seed.json";
import { messagesForLocale } from "../messages.js";
import type { HomeContent, HomeItem, HomeSection } from "./types.js";

type Product = {
  readonly slug: string;
  readonly title: string;
  readonly summary?: string;
  readonly priceMinor?: number;
  readonly currency?: string;
};

type LocaleSeed = {
  readonly "page-translations": readonly { readonly slug: string; readonly sections: readonly unknown[] }[];
  readonly "product-translations": readonly Product[];
};

function localeSeed(locale: string): LocaleSeed {
  const locales = seed.locales as unknown as Record<string, LocaleSeed>;
  const key = Object.keys(locales).find((candidate) => candidate.toLowerCase() === locale.toLowerCase());
  return locales[key ?? seed.canonicalLocale] ?? Object.values(locales)[0]!;
}

function fallback(locale: string): { readonly content: HomeContent; readonly products: readonly Product[] } {
  const selected = localeSeed(locale);
  const homePage = selected["page-translations"].find((page) => page.slug === "home");
  const products = selected["product-translations"].map((translation) => ({
    ...seed.collections.products.find((product) => product.slug === translation.slug),
    ...translation,
  }));
  return {
    content: {
      sections: [
        ...((homePage?.sections ?? []) as unknown as readonly HomeSection[]),
        {
          type: "features",
          id: "products",
          title: messagesForLocale(locale)["nav.products"],
          items: products.map((product) => productItem(product, locale)),
        },
      ],
    },
    products,
  };
}

export const homeLocale = seed.canonicalLocale;
export const homeContent = fallback(homeLocale).content;

export async function resolveHomeContent(
  getRuntime: () => Promise<CmsRuntime>,
  locale = homeLocale,
): Promise<HomeContent> {
  const runtime = await getRuntime();
  const seeded = fallback(locale);
  const site = bindMantleSite(runtime);
  const [pageResult, productResult] = await Promise.all([
    site.views["home"]({ params: { locale } }),
    site.views["public-products"]({ params: { locale } }),
  ]);
  if (!pageResult.ok) console.warn("Mantle home View failed; showing seed homepage", pageResult.diagnostic);
  if (!productResult.ok) console.warn("Mantle public-products View failed; showing seed catalog", productResult.diagnostic);

  const sections = pageResult.ok
    ? pageResult.result.rows[0]?.sections as readonly HomeSection[] | undefined
    : undefined;
  const translations = productResult.ok ? productResult.result.rows : [];
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
  const products: readonly Product[] = translations.length > 0
    ? translations.map((translation) => ({
        ...parentBySlug.get(translation.slug ?? ""),
        ...translation,
      } as Product))
    : seeded.products;

  return {
    sections: (sections?.length ? sections : seeded.content.sections).map((section) => section.id === "products"
      ? { ...section, items: products.map((product) => productItem(product, locale)) }
      : section),
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

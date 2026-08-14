import type { CollectionRouteConfig, PublicContentContext, PublicRouteContext } from "@aotter/mantle/cloudflare";
import {
  TemplateRegistry,
  createPublicPathResolver,
  pickPrimaryVariant,
  serializeEntryAsMarkdown,
  toUrlLocale,
  type MediaAsset,
} from "@aotter/mantle/runtime";
import type { Entry } from "@aotter/mantle/spec";
import { renderToString } from "hono/jsx/dom/server";
import { PageDocument } from "../renderer.js";
import { resolveHomeContent } from "./content/homeContent.js";
import type { HomeSection } from "./content/types.js";
import { commerceCopy, messagesForLocale } from "./messages.js";
import { HomePage, SitePage } from "./pages/HomePage.js";

export const publicCollectionRoutes = [
  { collection: "page-translations", segment: "pages", listRoute: true, homeSlug: "home" },
  { collection: "product-translations", segment: "products", listRoute: true },
] as const satisfies readonly CollectionRouteConfig[];

export const publicPathResolver = createPublicPathResolver({
  collectionRoutes: Object.fromEntries(publicCollectionRoutes.map((route) => [
    route.collection,
    { segment: route.segment, ...("homeSlug" in route ? { homeSlug: route.homeSlug } : {}) },
  ])),
});

export const templates = new TemplateRegistry();

templates.registerEntryTemplate("product-translations", ({ entry, site, seo, mediaAssets }) => {
  const locale = entry.locale ?? site.canonicalLocale ?? site.locales[0] ?? "en";
  const copy = commerceCopy(locale);
  const slug = text(entry.data["slug"], entry.id);
  const title = text(entry.data["title"], messagesForLocale(locale)["product.untitled"]);
  const summary = text(entry.data["summary"]);
  const description = text(entry.data["description"]);
  const coverUrl = text(entry.data["coverUrl"]);
  const coverAssetId = text(entry.data["coverAssetId"]);
  const productPrice = rawPrice(entry);
  return renderToString(
    <PageDocument locale={locale} title={`${title} · ${site.brand}`} description={summary} seo={seo} icons={site.icons}>
      <SitePage locale={locale} locales={site.locales} localePath={`/:locale/products/${slug}`} brand={site.brand}>
        <article class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <div class="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            {(coverAssetId || coverUrl) && <div class="overflow-hidden rounded-2xl border border-border bg-muted">
              <ProductImage assetId={coverAssetId} fallbackUrl={coverUrl} alt={title} mediaAssets={mediaAssets} className="aspect-[4/3] h-full w-full object-cover" loading="eager" />
            </div>}
            <div class="lg:py-4">
              <p class="text-xs font-medium uppercase tracking-wide text-primary">{copy.product}</p>
              <h1 class="mt-3 text-4xl tracking-tight sm:text-5xl">{title}</h1>
              {summary && <p class="mt-5 text-lg text-foreground-muted">{summary}</p>}
              <p class="mt-8 text-2xl font-semibold">{price(entry, locale)}</p>
              <div class="mt-10 flex flex-wrap items-center gap-4">
                {productPrice && <button
                  type="button"
                  class="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground"
                  data-add-to-cart
                  data-product-slug={slug}
                  data-added-label={copy.added}
                >{copy.add}</button>}
                <a href={`/${toUrlLocale(locale)}/products`} class="text-sm font-medium text-primary hover:underline">
                  {copy.back}
                </a>
              </div>
              {description && <p class="mt-10 whitespace-pre-line border-t border-border pt-8 leading-7 text-foreground-muted">
                {description}
              </p>}
            </div>
          </div>
        </article>
      </SitePage>
    </PageDocument>,
  );
});

templates.registerListTemplate("product-translations", ({ entries, locale, site, seo, mediaAssets }) => renderToString(
  <PageDocument locale={locale} title={`${commerceCopy(locale).products} · ${site.brand}`} description={site.description} seo={seo} icons={site.icons}>
    <SitePage locale={locale} locales={site.locales} localePath="/:locale/products" brand={site.brand}>
      <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <p class="text-xs font-medium uppercase tracking-wide text-primary">{commerceCopy(locale).shop}</p>
        <h1 class="mt-3 text-4xl tracking-tight sm:text-5xl">{commerceCopy(locale).products}</h1>
        <div class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => <ProductCard entry={entry} locale={locale} mediaAssets={mediaAssets} />)}
        </div>
        {entries.length === 0 && <p class="mt-8 text-foreground-muted">{commerceCopy(locale).noProducts}</p>}
      </section>
    </SitePage>
  </PageDocument>,
));

templates.registerEntryTemplate("page-translations", ({ entry, site, seo }) => {
  const locale = entry.locale ?? site.canonicalLocale ?? site.locales[0] ?? "en";
  const slug = text(entry.data["slug"], entry.id);
  const title = text(entry.data["title"], site.brand);
  return renderToString(
    <PageDocument locale={locale} title={`${title} · ${site.brand}`} description={text(entry.data["summary"])} seo={seo} icons={site.icons}>
      <HomePage
        content={{ sections: sections(entry) }}
        locale={locale}
        locales={site.locales}
        localePath={`/:locale/pages/${slug}`}
        brand={site.brand}
      />
    </PageDocument>,
  );
});

templates.registerListTemplate("page-translations", ({ entries, locale, site, seo }) => {
  const message = messagesForLocale(locale);
  const pages = entries.filter((entry) => entry.data["slug"] !== "home");
  return renderToString(
  <PageDocument locale={locale} title={`${message["pages.title"]} · ${site.brand}`} description={site.description} seo={seo} icons={site.icons}>
    <SitePage locale={locale} locales={site.locales} localePath="/:locale/pages" brand={site.brand}>
      <section class="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <p class="text-xs font-medium uppercase tracking-wide text-primary">{message["pages.label"]}</p>
        <h1 class="mt-3 text-4xl tracking-tight sm:text-5xl">{message["pages.title"]}</h1>
        <div class="mt-10 divide-y divide-border rounded-xl border border-border bg-card px-5">
          {pages.map((entry) => (
            <a href={`/${toUrlLocale(locale)}/pages/${text(entry.data["slug"], entry.id)}`} class="block py-5">
              <h2 class="text-xl tracking-tight">{text(entry.data["title"], message["pages.untitled"])}</h2>
              <p class="mt-2 text-sm text-foreground-muted">{text(entry.data["summary"])}</p>
            </a>
          ))}
        </div>
        {pages.length === 0 && <p class="mt-8 text-foreground-muted">{message["pages.noPages"]}</p>}
      </section>
    </SitePage>
  </PageDocument>,
  );
});

export async function renderPublicHome(ctx: PublicRouteContext): Promise<Response> {
  const content = await resolveHomeContent(async () => ctx.runtime, ctx.locale);
  return new Response(renderToString(
    <PageDocument locale={ctx.locale} title={ctx.site.brand} description={ctx.site.description} seo={ctx.seo} icons={ctx.site.icons}>
      <HomePage content={content} locale={ctx.locale} locales={ctx.site.locales} brand={ctx.site.brand} />
    </PageDocument>,
  ), {
    headers: { "cache-control": "public, max-age=0, s-maxage=300", "content-type": "text/html; charset=utf-8" },
  });
}

export async function renderHomeMarkdown(ctx: PublicContentContext): Promise<string | null> {
  const entry = await ctx.runtime.entryReader.readBySlug({
    collection: "page-translations",
    slug: "home",
    locale: ctx.locale,
    status: "published",
  });
  return entry ? serializeEntryAsMarkdown(entry) : null;
}

export async function renderNotFound(ctx: PublicRouteContext): Promise<Response> {
  const message = messagesForLocale(ctx.locale);
  return new Response(renderToString(
    <PageDocument locale={ctx.locale} title={`${message["notFound.title"]} · ${ctx.site.brand}`} icons={ctx.site.icons}>
      <SitePage locale={ctx.locale} locales={ctx.site.locales} localePath="/:locale" brand={ctx.site.brand}>
        <section class="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <p class="text-sm font-medium text-primary">404</p>
          <h1 class="mt-3 text-4xl tracking-tight">{message["notFound.title"]}</h1>
        </section>
      </SitePage>
    </PageDocument>,
  ), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

function ProductCard({ entry, locale, mediaAssets }: { readonly entry: Entry; readonly locale: string; readonly mediaAssets?: ReadonlyMap<string, MediaAsset> }) {
  const slug = text(entry.data["slug"], entry.id);
  const copy = commerceCopy(locale);
  const title = text(entry.data["title"], messagesForLocale(locale)["product.untitled"]);
  const coverUrl = text(entry.data["coverUrl"]);
  const coverAssetId = text(entry.data["coverAssetId"]);
  return (
    <article class="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-border-strong hover:shadow">
      <a href={`/${toUrlLocale(locale)}/products/${slug}`} class="group block">
        {(coverAssetId || coverUrl) && <div class="overflow-hidden bg-muted">
          <ProductImage assetId={coverAssetId} fallbackUrl={coverUrl} alt={title} mediaAssets={mediaAssets} className="aspect-[4/3] h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        </div>}
        <div class="p-5 pb-0">
          <h2 class="text-xl tracking-tight group-hover:text-primary">{title}</h2>
          <p class="mt-2 min-h-10 text-sm text-foreground-muted">{text(entry.data["summary"])}</p>
        </div>
      </a>
      <div class="p-5 pt-6">
        <p class="font-semibold">{price(entry, locale)}</p>
        {rawPrice(entry) && <button
          type="button"
          class="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          data-add-to-cart
          data-product-slug={slug}
          data-added-label={copy.added}
        >{copy.add}</button>}
      </div>
    </article>
  );
}

function ProductImage({ assetId, fallbackUrl, alt, mediaAssets, className, loading }: {
  readonly assetId: string;
  readonly fallbackUrl: string;
  readonly alt: string;
  readonly mediaAssets?: ReadonlyMap<string, MediaAsset>;
  readonly className: string;
  readonly loading: "eager" | "lazy";
}) {
  const asset = assetId ? mediaAssets?.get(assetId) : undefined;
  if (!asset) return fallbackUrl ? <img src={fallbackUrl} alt={alt} class={className} loading={loading} /> : null;
  const primary = pickPrimaryVariant(asset);
  return <picture>
    {asset.variants.filter((variant) => variant !== primary).map((variant) => (
      <source type={variant.mimeType} srcset={variant.publicUrl} />
    ))}
    <img src={primary.publicUrl} alt={alt} class={className} loading={loading} />
  </picture>;
}

function price(entry: Entry, locale: string): string {
  const value = rawPrice(entry);
  return value
    ? new Intl.NumberFormat(locale, { style: "currency", currency: value.currency }).format(value.priceMinor / 100)
    : "";
}

function rawPrice(entry: Entry): { readonly priceMinor: number; readonly currency: string } | null {
  const priceMinor = entry.data["priceMinor"];
  const currency = entry.data["currency"];
  return typeof priceMinor === "number" && typeof currency === "string" ? { priceMinor, currency } : null;
}

function sections(entry: Entry): readonly HomeSection[] {
  return Array.isArray(entry.data["sections"])
    ? entry.data["sections"] as unknown as readonly HomeSection[]
    : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

import type { CollectionRouteConfig, PublicContentContext, PublicRouteContext } from "@aotter/mantle/cloudflare";
import {
  TemplateRegistry,
  createPublicPathResolver,
  getEntryDescription,
  getMarkdownBody,
  serializeEntryAsMarkdown,
  type EntryContext,
  type ListContext,
} from "@aotter/mantle/web";
import { toUrlLocale } from "@aotter/mantle/runtime";
import type { Entry } from "@aotter/mantle/spec";
import { renderToString } from "hono/jsx/dom/server";
import { manifest } from "../../.mantle/generated/site.js";
import { PageDocument } from "../renderer.js";
import { resolveHomeContent } from "./content/homeContent.js";
import { HomePage, SitePage } from "./pages/HomePage.js";

const schemaNames = new Set<string>(manifest
  .filter((atom) => atom.kind === "Schema")
  .map((atom) => atom.metadata.name));

export const publicCollectionRoutes: readonly CollectionRouteConfig[] = [
  { collection: "post-translations", segment: "posts", listRoute: true },
  { collection: "community-updates", segment: "updates", listRoute: true },
].filter((route) => schemaNames.has(route.collection));

export const publicPathResolver = createPublicPathResolver({
  collectionRoutes: Object.fromEntries(publicCollectionRoutes.map((route) => [
    route.collection,
    { segment: route.segment },
  ])),
});

export const templates = new TemplateRegistry();

for (const collection of ["post-translations", "community-updates"]) {
  templates.registerEntryTemplate(collection, renderEntry);
  templates.registerListTemplate(collection, renderList);
}

export async function renderPublicHome(ctx: PublicRouteContext): Promise<Response> {
  const content = await resolveHomeContent(async () => ctx.runtime, ctx.locale);
  return new Response(renderToString(
    <PageDocument locale={ctx.locale} title={ctx.site.title} description={ctx.site.description} seo={ctx.seo} icons={ctx.site.icons}>
      <HomePage
        content={content}
        locale={ctx.locale}
        locales={ctx.site.locales}
        brand={ctx.site.brand}
        turnstileSiteKey={ctx.c.env["TURNSTILE_SITE_KEY"]}
      />
    </PageDocument>,
  ));
}

export async function renderHomeMarkdown(ctx: PublicContentContext): Promise<string | null> {
  const entry = await ctx.runtime.entryReader.readByDataField({
    collection: "page",
    field: "type",
    value: "home",
    status: "published",
  });
  return entry ? serializeEntryAsMarkdown(entry) : null;
}

export async function renderNotFound(ctx: PublicRouteContext): Promise<Response> {
  return new Response(renderToString(
    <PageDocument locale={ctx.locale} title={`Not found · ${ctx.site.brand}`} icons={ctx.site.icons}>
      <SitePage locale={ctx.locale} locales={ctx.site.locales} localePath="/:locale" brand={ctx.site.brand}>
        <section class="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
          <p class="text-sm font-medium text-primary">404</p>
          <h1 class="mt-3 text-4xl tracking-tight">Not found</h1>
        </section>
      </SitePage>
    </PageDocument>,
  ), { status: 404 });
}

function renderEntry({ entry, site, seo }: EntryContext): string {
  const locale = seo?.og.locale ?? entry.locale ?? site.canonicalLocale ?? site.locales[0] ?? "en";
  const title = text(entry.data["title"], entry.id);
  const segment = segmentFor(entry.collection);
  const slug = text(entry.data["slug"], entry.id);
  const body = getMarkdownBody(entry) ?? "";
  return renderToString(
    <PageDocument locale={locale} title={`${title} · ${site.brand}`} description={getEntryDescription(entry) ?? undefined} seo={seo} icons={site.icons}>
      <SitePage locale={locale} locales={site.locales} localePath={`/:locale/${segment}/${slug}`} brand={site.brand}>
        <article class="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <h1 class="text-4xl tracking-tight sm:text-5xl">{title}</h1>
          <div class="mt-8 whitespace-pre-wrap text-foreground-muted">{body}</div>
          <a href={`/${toUrlLocale(locale)}/${segment}`} class="mt-10 inline-block text-sm font-medium text-primary hover:underline">
            Back
          </a>
        </article>
      </SitePage>
    </PageDocument>,
  );
}

function renderList({ collection, entries, locale, site, seo }: ListContext): string {
  const segment = segmentFor(collection);
  const title = collection === "post-translations" ? "Posts" : "Updates";
  return renderToString(
    <PageDocument locale={locale} title={`${title} · ${site.brand}`} description={site.description} seo={seo} icons={site.icons}>
      <SitePage locale={locale} locales={site.locales} localePath={`/:locale/${segment}`} brand={site.brand}>
        <section class="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <h1 class="text-4xl tracking-tight sm:text-5xl">{title}</h1>
          <div class="mt-10 divide-y divide-border rounded-xl border border-border bg-card px-5">
            {entries.map((entry) => <EntryLink entry={entry} locale={locale} segment={segment} />)}
          </div>
        </section>
      </SitePage>
    </PageDocument>,
  );
}

function EntryLink({ entry, locale, segment }: { readonly entry: Entry; readonly locale: string; readonly segment: string }) {
  const slug = text(entry.data["slug"], entry.id);
  return (
    <a href={`/${toUrlLocale(locale)}/${segment}/${slug}`} class="block py-5">
      <h2 class="text-xl tracking-tight">{text(entry.data["title"], entry.id)}</h2>
      <p class="mt-2 text-sm text-foreground-muted">{getEntryDescription(entry)}</p>
    </a>
  );
}

function segmentFor(collection: string): string {
  return collection === "post-translations" ? "posts" : "updates";
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

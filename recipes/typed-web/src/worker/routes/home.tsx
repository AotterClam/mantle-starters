import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import { toUrlLocale } from "@aotter/mantle/runtime";
import { HomePage } from "../../web/pages/HomePage.js";
import { resolveHomeContent } from "../../web/content/homeContent.js";
import { PageDocument } from "../../renderer.js";
import type { Env } from "../../mantle/config.js";

export function mountHomeRoute(
  app: MantleExtensionApp<Env>,
  getRuntime: () => Promise<CmsRuntime>,
): void {
  app.get("/", async (c) => {
    c.header("cache-control", "public, max-age=0, s-maxage=300");
    const runtime = await getRuntime();
    const site = await runtime.siteConfig.load();
    const locale = site.canonicalLocale ?? site.locales[0] ?? "en";
    const content = await resolveHomeContent(async () => runtime);
    return c.html(
      <PageDocument locale={locale}>
        <HomePage
          content={content}
          locale={locale}
          locales={site.locales}
          brand={site.brand}
          turnstileSiteKey={c.env.TURNSTILE_SITE_KEY}
        />
      </PageDocument>,
    );
  });
  app.get("/:locale", async (c) => {
    const runtime = await getRuntime();
    const site = await runtime.siteConfig.load();
    const requested = c.req.param("locale").toLowerCase();
    const locale = site.locales.find((candidate) => toUrlLocale(candidate) === requested);
    if (!locale) return c.notFound();
    c.header("cache-control", "public, max-age=0, s-maxage=300");
    const content = await resolveHomeContent(async () => runtime);
    return c.html(
      <PageDocument locale={locale}>
        <HomePage
          content={content}
          locale={locale}
          locales={site.locales}
          brand={site.brand}
          turnstileSiteKey={c.env.TURNSTILE_SITE_KEY}
        />
      </PageDocument>,
    );
  });
}

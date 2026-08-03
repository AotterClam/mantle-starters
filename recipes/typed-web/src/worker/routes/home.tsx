import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import type { CmsRuntime } from "@aotter/mantle/runtime";
import { HomePage } from "../../web/pages/HomePage.js";
import { homeLocale, resolveHomeContent } from "../../web/content/homeContent.js";
import { PageDocument } from "../../renderer.js";
import type { Env } from "../../mantle/config.js";

export function mountHomeRoute(
  app: MantleExtensionApp<Env>,
  getRuntime: () => Promise<CmsRuntime>,
): void {
  app.get("/", async (c) => {
    c.header("cache-control", "public, max-age=0, s-maxage=300");
    const content = await resolveHomeContent(getRuntime);
    return c.html(
      <PageDocument locale={homeLocale}>
        <HomePage
          content={content}
          locale={homeLocale}
          turnstileSiteKey={c.env.TURNSTILE_SITE_KEY}
        />
      </PageDocument>,
    );
  });
}

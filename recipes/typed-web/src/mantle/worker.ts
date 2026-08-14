import { createMantleWorker, mountPublicRoutes } from "@aotter/mantle/cloudflare";
import { manifest } from "../../.mantle/generated/site.js";
import {
  publicCollectionRoutes,
  publicPathResolver,
  renderHomeMarkdown,
  renderNotFound,
  renderPublicHome,
  templates,
} from "../web/publicSite.js";
import { mountTypeRoutes } from "../web/typeRoutes.js";
import { buildSiteDefaults, type Env } from "./config.js";
import { buildHandlers } from "./handlers/index.js";
import { createSeededRuntime } from "./seed.js";
import { localeRootResponse } from "../web/localeRoot.js";

export const mantle = createMantleWorker<Env>({
  manifest,
  siteDefaults: buildSiteDefaults,
  templates,
  publicPathResolver,
  extend: ({ getRuntime }) => ({
    handlers: buildHandlers(getRuntime),
    mount({ app, ref }) {
      app.get("/", async (c) => {
        const site = await (await ref.get()).siteConfig.load();
        return localeRootResponse(c.req.raw, site.locales, site.canonicalLocale ?? site.locales[0] ?? "en");
      });
      mountPublicRoutes(app as unknown as Parameters<typeof mountPublicRoutes>[0], ref, {
        collectionRoutes: publicCollectionRoutes,
        homeRenderer: renderPublicHome,
        homeMarkdown: renderHomeMarkdown,
        notFoundRenderer: renderNotFound,
      });
      mountTypeRoutes(app, getRuntime);
    },
  }),
});

export const getRuntime = createSeededRuntime((env: Env) => mantle.getRuntime(env));

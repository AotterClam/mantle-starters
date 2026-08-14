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
import { buildMediaStorage, buildSiteDefaults, type Env } from "./config.js";
import { buildHandlers } from "./handlers/index.js";
import { createSeededRuntime } from "./seed.js";

export const mantle = createMantleWorker<Env>({
  manifest,
  siteDefaults: buildSiteDefaults,
  bindings: (env, conventional) => ({ ...conventional, mediaStorage: buildMediaStorage(env) }),
  templates,
  publicPathResolver,
  extend: ({ getRuntime }) => ({
    handlers: buildHandlers(getRuntime),
    mount({ app, ref }) {
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

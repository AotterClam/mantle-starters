import { createMantleWorker, mountPublicRoutes } from "@aotter/mantle/cloudflare";
import { manifest } from "../.mantle/generated/site.js";
import { buildAuth } from "./auth.js";
import { buildSiteDefaults, type Env } from "./mantle/config.js";
import { buildHandlers } from "./mantle/handlers/index.js";
import {
  publicCollectionRoutes,
  publicPathResolver,
  renderNotFound,
  renderPublicHome,
  templates,
} from "./web/publicSite.js";
import { mountAssetRoutes } from "./worker/routes/assets.js";

export default createMantleWorker<Env>({
  manifest,
  auth: buildAuth,
  handlers: buildHandlers(),
  siteDefaults: buildSiteDefaults,
  templates,
  publicPathResolver,
  extend: () => ({
    mount({ app, ref }) {
      mountPublicRoutes(app as unknown as Parameters<typeof mountPublicRoutes>[0], ref, {
        collectionRoutes: publicCollectionRoutes,
        homeRenderer: renderPublicHome,
        notFoundRenderer: renderNotFound,
      });
      mountAssetRoutes(app);
    },
  }),
});

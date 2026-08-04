import { createMantleWorker } from "@aotter/mantle/cloudflare";
import { manifest } from "../.mantle/generated/site.js";
import { buildAuth } from "./auth.js";
import { buildSiteDefaults, type Env } from "./mantle/config.js";
import { buildHandlers } from "./mantle/handlers/index.js";
import { mountAssetRoutes } from "./worker/routes/assets.js";
import { mountHomeRoute } from "./worker/routes/home.js";

export default createMantleWorker<Env>({
  manifest,
  auth: buildAuth,
  handlers: buildHandlers(),
  siteDefaults: buildSiteDefaults,
  extend: () => ({
    mount({ app, getRuntime }) {
      mountHomeRoute(app, getRuntime);
      mountAssetRoutes(app);
    },
  }),
});

import { createMantleWorker } from "@aotter/mantle/cloudflare";
import { manifest } from "../.mantle/generated/site.js";
import { buildAuth } from "./auth.js";
import { buildSiteDefaults, type Env } from "./mantle/config.js";
import { buildHandlers } from "./mantle/handlers/index.js";
import { createSeededRuntime } from "./mantle/seed.js";
import { mountAssetRoutes } from "./worker/routes/assets.js";
import { mountHomeRoute } from "./worker/routes/home.js";

const mantle = createMantleWorker<Env>({
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

const getRuntime = createSeededRuntime((env: Env) => mantle.getRuntime(env));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await getRuntime(env);
    return mantle.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

import { createMantleWorker, mountPublicRoutes } from "@aotter/mantle/cloudflare";
import { bindMantleSite, manifest } from "../.mantle/generated/site.js";
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
import { mountCommerceRoutes } from "./web/commerceRoutes.js";

const mantle = createMantleWorker<Env>({
  manifest,
  auth: buildAuth,
  siteDefaults: buildSiteDefaults,
  templates,
  publicPathResolver,
  extend: ({ getRuntime }) => ({
    handlers: buildHandlers(getRuntime),
    mount({ app, ref }) {
      mountPublicRoutes(app as unknown as Parameters<typeof mountPublicRoutes>[0], ref, {
        collectionRoutes: publicCollectionRoutes,
        homeRenderer: renderPublicHome,
        notFoundRenderer: renderNotFound,
      });
      mountCommerceRoutes(app, getRuntime);
      mountAssetRoutes(app);
    },
  }),
});

export { InventoryCoordinator } from "./commerce/InventoryCoordinator.js";

export default {
  fetch: mantle.fetch,

  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    let site: ReturnType<typeof bindMantleSite>;
    try {
      site = bindMantleSite(await mantle.getRuntime(env));
    } catch (error) {
      console.error("[transaction queue] runtime unavailable", error);
      batch.retryAll();
      return;
    }

    for (const message of batch.messages) {
      if (!isExpiryMessage(message.body)) {
        console.error("[transaction queue] discarded invalid message", message.id);
        message.ack();
        continue;
      }
      try {
        const result = await site.procedures["expire-order"](
          { orderToken: message.body.orderToken, now: Date.now() },
          internalContext(env, ctx),
        );
        if (!result.ok) {
          console.error("[transaction queue] procedure failure", message.id, result.diagnostic.code);
          if (result.diagnostic.code === "INTERNAL_ERROR") message.retry();
          else message.ack();
        } else if (result.data.outcome === "too_early") {
          message.retry({ delaySeconds: 60 });
        } else {
          message.ack();
        }
      } catch (error) {
        console.error("[transaction queue] transient dispatch failure", message.id, error);
        message.retry();
      }
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const site = bindMantleSite(await mantle.getRuntime(env));
    const result = await site.procedures["sweep-expired-orders"]({ now: Date.now() }, internalContext(env, ctx));
    if (!result.ok) throw new Error(`scheduled expiry sweep failed: ${result.diagnostic.code}`);
  },
} satisfies ExportedHandler<Env, unknown>;

function internalContext(env: Env, ctx: ExecutionContext) {
  return {
    user: null,
    staff: null,
    env,
    waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise),
  } as const;
}

function isExpiryMessage(value: unknown): value is { readonly type: "expire-order"; readonly orderToken: string } {
  return typeof value === "object"
    && value !== null
    && (value as Record<string, unknown>)["type"] === "expire-order"
    && typeof (value as Record<string, unknown>)["orderToken"] === "string";
}

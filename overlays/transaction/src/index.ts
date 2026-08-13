import { bindMantleSite } from "../.mantle/generated/site.js";
import type { Env } from "./mantle/config.js";
import { getRuntime, mantle } from "./mantle/worker.js";

export { InventoryCoordinator } from "./commerce/InventoryCoordinator.js";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await getRuntime(env);
    return mantle.fetch(request, env, ctx);
  },

  async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    let site: ReturnType<typeof bindMantleSite>;
    try {
      site = bindMantleSite(await getRuntime(env));
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
          if (result.diagnostic.code === "INTERNAL_ERROR" || result.diagnostic.code === "CONFLICT") message.retry();
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
    const site = bindMantleSite(await getRuntime(env));
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

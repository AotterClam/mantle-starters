import type { CmsRuntime, HandlerContext } from "@aotter/mantle/runtime";
import { DiagnosticError, runtimeDiagnostic, type Entry } from "@aotter/mantle/spec";
import type { MantleHandlers, MantleSite } from "../../.mantle/generated/types.js";
import type { Env } from "../mantle/config.js";
import type { StockItem, StockSnapshot, TransitionResult } from "./InventoryCoordinator.js";

const CHECKOUT_TTL_MS = 15 * 60 * 1000;

type RuntimeGetter = () => Promise<CmsRuntime>;
type Context = HandlerContext<Env>;
type OrderData = MantleSite.Entry_orders;
type OrderItem = OrderData["items"][number];
type MovementKind = MantleSite.Entry_inventory_movements["kind"];
type PlaceOrderInput = {
  readonly locale: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly shippingAddress: string;
  readonly items: readonly StockItem[];
};
type PendingOrder = {
  readonly outcome: "pending_payment";
  readonly orderToken: string;
  readonly orderNumber: string;
  readonly expiresAt: number;
  readonly totalMinor: number;
  readonly currency: string;
};

export function buildCommerceHandlers(getRuntime: RuntimeGetter): MantleHandlers<Env> {
  return {
    placeOrder: (input, ctx) => placePendingOrder(getRuntime, input, ctx),

    createManualOrder: async ({ operationId, ...input }, ctx) => {
      const order = await placePendingOrder(getRuntime, input, ctx, operationId);
      return { orderToken: order.orderToken, orderNumber: order.orderNumber };
    },

    payOrder: async ({ orderToken }, ctx) => {
      const runtime = await getRuntime();
      const order = await orderByToken(runtime, orderToken);
      if (!order) return { outcome: "missing", orderToken };
      const result = await inventory(ctx.env).pay(orderToken, Date.now());
      if (result.outcome === "paid" || result.outcome === "already_paid") {
        await persistTransition(runtime, order, "paid", result, "sale", ctx, { paidAt: Date.now() });
      } else if (result.outcome === "expired") {
        await expirePersistedOrder(runtime, order, result, ctx);
      }
      return { outcome: publicOutcome(result.outcome), orderToken };
    },

    cancelGuestOrder: async ({ orderToken }, ctx) => {
      const runtime = await getRuntime();
      const order = await orderByToken(runtime, orderToken);
      if (!order) return { outcome: "missing", orderToken };
      if (orderData(order).orderStatus === "cancelled") return { outcome: "already_cancelled", orderToken };
      if (orderData(order).orderStatus !== "pending_payment") return { outcome: "closed", orderToken };
      const result = await inventory(ctx.env).cancel(orderToken);
      if (result.outcome === "cancelled" || result.outcome === "already_cancelled") {
        await persistTransition(runtime, order, "cancelled", result, "release", ctx, {
          cancelledAt: Date.now(),
          cancelReason: "Cancelled by customer before payment",
        });
      }
      return { outcome: cancelOutcome(result.outcome), orderToken };
    },

    adjustInventory: async ({ operationId, productSlug, delta, reason }, ctx) => {
      const runtime = await getRuntime();
      await requireProduct(runtime, productSlug);
      if (delta === 0) invalid("/delta", delta, "a non-zero stock adjustment");
      const result = await inventory(ctx.env).adjust(operationId, productSlug, delta, reason);
      if (result.outcome === "idempotency_conflict") {
        throw new DiagnosticError(runtimeDiagnostic({
          code: "CONFLICT",
          severity: "error",
          path: "/operationId",
          value: operationId,
          expected: "an idempotency key used with the same adjustment input",
        }));
      }
      if (result.outcome === "insufficient_stock") {
        throw new DiagnosticError(runtimeDiagnostic({
          code: "CONFLICT",
          severity: "error",
          path: "/delta",
          value: delta,
          expected: "an adjustment that keeps available stock non-negative",
        }));
      }
      await persistSnapshots(runtime, [result.snapshot], ctx);
      await ensureMovement(runtime, `adjust:${operationId}`, {
        productSlug,
        kind: "adjust",
        availableDelta: delta,
        reservedDelta: 0,
        note: reason,
      }, ctx);
      return result.snapshot;
    },

    fulfillOrder: async ({ orderToken, trackingNumber }, ctx) => {
      const runtime = await getRuntime();
      const order = await orderByToken(runtime, orderToken);
      if (!order) return { outcome: "missing", orderToken };
      const result = await inventory(ctx.env).fulfill(orderToken);
      if (result.outcome === "fulfilled" || result.outcome === "already_fulfilled") {
        await updateOrder(runtime, orderToken, {
          orderStatus: "fulfilled",
          fulfilledAt: Date.now(),
          ...(trackingNumber ? { trackingNumber } : {}),
        }, ctx);
      }
      return { outcome: fulfillOutcome(result.outcome), orderToken };
    },

    cancelOrder: async ({ orderToken, reason }, ctx) => {
      const runtime = await getRuntime();
      const order = await orderByToken(runtime, orderToken);
      if (!order) return { outcome: "missing", orderToken };
      const result = await inventory(ctx.env).cancel(orderToken);
      if (result.outcome === "cancelled" || result.outcome === "already_cancelled") {
        const movement = orderData(order).orderStatus === "pending_payment" ? "release" : "cancellation";
        await persistTransition(runtime, order, "cancelled", result, movement, ctx, {
          cancelledAt: Date.now(),
          cancelReason: reason,
        });
      }
      return { outcome: cancelOutcome(result.outcome), orderToken };
    },

    expireOrder: (input, ctx) => expireOrder(getRuntime, input.orderToken, input.now, ctx),

    sweepExpiredOrders: async ({ now }, ctx) => {
      const runtime = await getRuntime();
      // ponytail: one 100-row sweep fits the starter; cursor-walk when pending checkout volume exceeds this.
      const pending = await runtime.listEntries.execute({
        collection: "orders",
        filter: { field: "orderStatus", value: "pending_payment" },
        limit: 100,
      });
      let expired = 0;
      for (const order of pending) {
        if (orderData(order).expiresAt > now) continue;
        const result = await expireOrder(() => Promise.resolve(runtime), orderData(order).orderToken, now, ctx);
        if (result.outcome === "expired") expired += 1;
      }
      return { checked: pending.length, expired };
    },
  };
}

async function placePendingOrder(
  getRuntime: RuntimeGetter,
  input: PlaceOrderInput,
  ctx: Context,
  orderToken = crypto.randomUUID(),
): Promise<PendingOrder> {
  const runtime = await getRuntime();
  const existing = await orderByToken(runtime, orderToken);
  if (existing) {
    const order = orderData(existing);
    return {
      outcome: "pending_payment",
      orderToken,
      orderNumber: order.orderNumber,
      expiresAt: order.expiresAt,
      totalMinor: order.totalMinor,
      currency: order.currency,
    };
  }

  const locales = await runtime.siteConfig.readLocales();
  if (!locales.includes(input.locale)) invalid("/locale", input.locale, "a configured site locale");

  const requested = combineItems(input.items);
  const priced = await Promise.all(requested.map(async (item): Promise<OrderItem & { currency: string }> => {
    const product = await runtime.entryReader.readBySlug({
      collection: "products",
      slug: item.productSlug,
      status: "published",
    });
    const translation = await runtime.entryReader.readBySlug({
      collection: "product-translations",
      slug: item.productSlug,
      locale: input.locale,
      status: "published",
    });
    const priceMinor = product?.data["priceMinor"];
    const currency = product?.data["currency"];
    if (!product || typeof priceMinor !== "number" || typeof currency !== "string") {
      invalid(`/items/${item.productSlug}`, item.productSlug, "a published product");
    }
    const title = translation?.data["title"];
    return {
      productSlug: item.productSlug,
      title: typeof title === "string" ? title : item.productSlug,
      quantity: item.quantity,
      unitPriceMinor: priceMinor,
      lineTotalMinor: priceMinor * item.quantity,
      currency,
    };
  }));
  const currencies = new Set(priced.map((item) => item.currency));
  if (currencies.size !== 1) invalid("/items", input.items, "products sharing one currency");

  const now = Date.now();
  const orderNumber = `MNT-${new Date(now).toISOString().slice(0, 10).replaceAll("-", "")}-${orderToken.slice(0, 8).toUpperCase()}`;
  const expiresAt = now + CHECKOUT_TTL_MS;
  const stockItems = priced.map(({ productSlug, quantity }) => ({ productSlug, quantity }));
  await initializeInventory(runtime, ctx.env, stockItems);
  const reserved = await inventory(ctx.env).reserve(orderToken, stockItems, expiresAt);
  if (reserved.outcome === "insufficient_stock") {
    throw new DiagnosticError(runtimeDiagnostic({
      code: "CONFLICT",
      severity: "error",
      path: "/items",
      value: reserved.insufficient,
      expected: "quantities currently in stock",
    }));
  }
  if (reserved.outcome !== "reserved") throw new Error(`unexpected reservation outcome: ${reserved.outcome}`);

  const items = priced.map(({ currency: _currency, ...item }) => item);
  const totalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  let created: Entry | null = null;
  try {
    created = await runtime.createDraft.execute({
      collection: "orders",
      authorId: null,
      ctx,
      data: {
        orderToken,
        orderNumber,
        orderStatus: "pending_payment",
        orderLocale: input.locale,
        currency: [...currencies][0],
        subtotalMinor: totalMinor,
        totalMinor,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        shippingAddress: input.shippingAddress,
        items,
        expiresAt,
      },
    });
    await recordStockChange(runtime, reserved.snapshots, stockItems, "reserve", orderToken, ctx);
  } catch (error) {
    await inventory(ctx.env).cancel(orderToken);
    if (created) await runtime.deleteEntry.execute({ id: created.id, collection: "orders", ctx });
    throw error;
  }

  const enqueue = ctx.env.ORDER_EXPIRY_QUEUE.send(
    { type: "expire-order", orderToken },
    { contentType: "json", delaySeconds: CHECKOUT_TTL_MS / 1000 },
  ).catch((error) => console.error(`[transaction] could not enqueue expiry for ${orderToken}`, error));
  if (ctx.waitUntil) ctx.waitUntil(enqueue);
  else await enqueue;
  return { outcome: "pending_payment", orderToken, orderNumber, expiresAt, totalMinor, currency: [...currencies][0]! };
}

async function expireOrder(
  getRuntime: RuntimeGetter,
  orderToken: string,
  now: number,
  ctx: Context,
): Promise<{ outcome: "expired" | "too_early" | "closed" | "missing"; orderToken: string }> {
  const runtime = await getRuntime();
  const result = await inventory(ctx.env).expire(orderToken, now);
  const order = await orderByToken(runtime, orderToken);
  if (result.outcome === "expired" && order) await expirePersistedOrder(runtime, order, result, ctx);
  return { outcome: expiryOutcome(result.outcome), orderToken };
}

async function expirePersistedOrder(
  runtime: CmsRuntime,
  order: Entry,
  result: TransitionResult,
  ctx: Context,
): Promise<void> {
  const items = result.items ?? orderData(order).items;
  const snapshots = result.snapshots ?? await inspectItems(ctx.env, items);
  await recordStockChange(runtime, snapshots, items, "release", orderData(order).orderToken, ctx);
  const fresh = await orderByToken(runtime, orderData(order).orderToken);
  if (fresh) await runtime.deleteEntry.execute({ id: fresh.id, collection: "orders", ctx });
}

async function persistTransition(
  runtime: CmsRuntime,
  order: Entry,
  orderStatus: "paid" | "cancelled",
  result: TransitionResult,
  kind: "sale" | "release" | "cancellation",
  ctx: Context,
  patch: Record<string, unknown>,
): Promise<void> {
  const items = result.items ?? orderData(order).items;
  const snapshots = result.snapshots ?? await inspectItems(ctx.env, items);
  await recordStockChange(runtime, snapshots, items, kind, orderData(order).orderToken, ctx);
  await updateOrder(runtime, orderData(order).orderToken, { orderStatus, ...patch }, ctx);
}

async function recordStockChange(
  runtime: CmsRuntime,
  snapshots: readonly StockSnapshot[],
  items: readonly StockItem[],
  kind: "reserve" | "sale" | "release" | "cancellation",
  orderToken: string,
  ctx: Context,
): Promise<void> {
  await persistSnapshots(runtime, snapshots, ctx);
  for (const item of items) {
    const reserve = kind === "reserve";
    const release = kind === "release";
    await ensureMovement(runtime, `${kind}:${orderToken}:${item.productSlug}`, {
      productSlug: item.productSlug,
      orderToken,
      kind,
      availableDelta: reserve ? -item.quantity : release || kind === "cancellation" ? item.quantity : 0,
      reservedDelta: reserve ? item.quantity : release || kind === "sale" ? -item.quantity : 0,
    }, ctx);
  }
}

async function persistSnapshots(runtime: CmsRuntime, values: readonly StockSnapshot[], ctx: Context): Promise<void> {
  for (const value of values) {
    for (;;) {
      const existing = await runtime.entryReader.readByDataField({
        collection: "inventory",
        field: "productSlug",
        value: value.productSlug,
      });
      const currentRevision = existing?.data["revision"];
      if (typeof currentRevision === "number" && currentRevision >= value.revision) break;
      const data = { ...value, updatedAt: Date.now() };
      if (!existing) {
        try {
          await runtime.createDraft.execute({ collection: "inventory", data, authorId: null, ctx });
          break;
        } catch (error) {
          const raced = await runtime.entryReader.readByDataField({
            collection: "inventory",
            field: "productSlug",
            value: value.productSlug,
          });
          if (!raced) throw error;
          continue;
        }
      }
      try {
        await runtime.updateDraft.execute({ id: existing.id, expectedVersion: existing.version, data, ctx });
        break;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "EntryVersionConflict") throw error;
      }
    }
  }
}

async function ensureMovement(
  runtime: CmsRuntime,
  movementKey: string,
  data: Omit<MantleSite.Entry_inventory_movements, "movementKey" | "occurredAt">,
  ctx: Context,
): Promise<void> {
  const existing = await runtime.entryReader.readByDataField({
    collection: "inventory-movements",
    field: "movementKey",
    value: movementKey,
  });
  if (!existing) {
    try {
      await runtime.createDraft.execute({
        collection: "inventory-movements",
        authorId: null,
        ctx,
        data: { movementKey, occurredAt: Date.now(), ...data },
      });
    } catch (error) {
      const raced = await runtime.entryReader.readByDataField({
        collection: "inventory-movements",
        field: "movementKey",
        value: movementKey,
      });
      if (!raced) throw error;
    }
  }
}

async function updateOrder(
  runtime: CmsRuntime,
  orderToken: string,
  data: Record<string, unknown>,
  ctx: Context,
): Promise<void> {
  const current = await orderByToken(runtime, orderToken);
  if (current) await runtime.updateDraft.execute({ id: current.id, expectedVersion: current.version, data, ctx });
}

async function orderByToken(runtime: CmsRuntime, orderToken: string): Promise<Entry | null> {
  return runtime.entryReader.readByDataField({ collection: "orders", field: "orderToken", value: orderToken });
}

async function requireProduct(runtime: CmsRuntime, productSlug: string): Promise<void> {
  if (!await runtime.entryReader.readByDataField({ collection: "products", field: "slug", value: productSlug })) {
    invalid("/productSlug", productSlug, "an existing product slug");
  }
}

async function inspectItems(env: Env, items: readonly StockItem[]): Promise<readonly StockSnapshot[]> {
  return Promise.all(items.map((item) => inventory(env).inspect(item.productSlug)));
}

async function initializeInventory(runtime: CmsRuntime, env: Env, items: readonly StockItem[]): Promise<void> {
  const coordinator = inventory(env);
  for (const item of items) {
    const entry = await runtime.entryReader.readByDataField({
      collection: "inventory",
      field: "productSlug",
      value: item.productSlug,
    });
    const available = entry?.data["available"];
    const reserved = entry?.data["reserved"];
    const revision = entry?.data["revision"];
    if (typeof available === "number" && typeof reserved === "number") {
      await coordinator.initializeProduct(item.productSlug, available, reserved, typeof revision === "number" ? revision : 0);
    }
  }
}

function inventory(env: Env) {
  // ponytail: one coordinator per provisioned shop keeps multi-SKU reservations atomic; shard only after measured per-shop saturation.
  return env.INVENTORY_COORDINATOR.getByName("site");
}

function orderData(entry: Entry): OrderData {
  return entry.data as unknown as OrderData;
}

function combineItems(items: readonly StockItem[]): readonly StockItem[] {
  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productSlug, (quantities.get(item.productSlug) ?? 0) + item.quantity);
  const combined = [...quantities].map(([productSlug, quantity]) => ({ productSlug, quantity }));
  if (combined.some((item) => item.quantity > 99)) invalid("/items", items, "at most 99 units of each product");
  return combined;
}

function publicOutcome(outcome: TransitionResult["outcome"]): "paid" | "already_paid" | "expired" | "closed" | "missing" {
  return outcome === "paid" || outcome === "already_paid" || outcome === "expired" || outcome === "missing"
    ? outcome
    : "closed";
}

function cancelOutcome(outcome: TransitionResult["outcome"]): "cancelled" | "already_cancelled" | "closed" | "missing" {
  return outcome === "cancelled" || outcome === "already_cancelled" || outcome === "missing"
    ? outcome
    : "closed";
}

function fulfillOutcome(outcome: TransitionResult["outcome"]): "fulfilled" | "already_fulfilled" | "closed" | "missing" {
  return outcome === "fulfilled" || outcome === "already_fulfilled" || outcome === "missing"
    ? outcome
    : "closed";
}

function expiryOutcome(outcome: TransitionResult["outcome"]): "expired" | "too_early" | "closed" | "missing" {
  return outcome === "expired" || outcome === "too_early" || outcome === "missing"
    ? outcome
    : "closed";
}

function invalid(path: string, value: unknown, expected: string): never {
  throw new DiagnosticError(runtimeDiagnostic({
    code: "INPUT_VALIDATION_FAILED",
    severity: "error",
    path,
    value,
    expected,
    message: `Invalid commerce input at ${path}.`,
  }));
}

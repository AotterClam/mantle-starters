import { DurableObject } from "cloudflare:workers";

export type StockItem = {
  readonly productSlug: string;
  readonly quantity: number;
};

export type StockSnapshot = {
  readonly productSlug: string;
  readonly available: number;
  readonly reserved: number;
};

type OrderState = {
  readonly items: readonly StockItem[];
  readonly expiresAt: number;
  readonly status: "pending_payment" | "paid" | "fulfilled" | "cancelled" | "expired";
};

type InventoryRecord = Omit<StockSnapshot, "productSlug">;

export type ReserveResult =
  | { readonly outcome: "reserved" | "already_reserved"; readonly snapshots: readonly StockSnapshot[] }
  | { readonly outcome: "insufficient_stock"; readonly insufficient: readonly StockSnapshot[] }
  | { readonly outcome: "closed" };

export type TransitionResult = {
  readonly outcome:
    | "paid"
    | "already_paid"
    | "fulfilled"
    | "already_fulfilled"
    | "cancelled"
    | "already_cancelled"
    | "expired"
    | "too_early"
    | "missing"
    | "closed";
  readonly items?: readonly StockItem[];
  readonly snapshots?: readonly StockSnapshot[];
};

export class InventoryCoordinator extends DurableObject {
  async initializeProduct(productSlug: string, available: number, reserved: number): Promise<StockSnapshot> {
    return this.ctx.storage.transaction(async (txn) => {
      const key = inventoryKey(productSlug);
      const existing = await txn.get<InventoryRecord>(key);
      if (existing) return snapshot(productSlug, existing);
      const initial = { available, reserved };
      await txn.put(key, initial);
      return snapshot(productSlug, initial);
    });
  }

  async reserve(orderId: string, items: readonly StockItem[], expiresAt: number): Promise<ReserveResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const existing = await txn.get<OrderState>(orderKey(orderId));
      if (existing) {
        return existing.status === "pending_payment"
          ? { outcome: "already_reserved", snapshots: await snapshots(txn, existing.items) }
          : { outcome: "closed" };
      }

      const current = await inventory(txn, items);
      const insufficient = items
        .filter((item) => (current.get(item.productSlug)?.available ?? 0) < item.quantity)
        .map((item) => snapshot(item.productSlug, current.get(item.productSlug)));
      if (insufficient.length > 0) return { outcome: "insufficient_stock", insufficient };

      for (const item of items) {
        const value = current.get(item.productSlug)!;
        await txn.put(inventoryKey(item.productSlug), {
          available: value.available - item.quantity,
          reserved: value.reserved + item.quantity,
        });
      }
      await txn.put(orderKey(orderId), { items, expiresAt, status: "pending_payment" } satisfies OrderState);
      return { outcome: "reserved", snapshots: await snapshots(txn, items) };
    });
  }

  async pay(orderId: string, now: number): Promise<TransitionResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const order = await txn.get<OrderState>(orderKey(orderId));
      if (!order) return { outcome: "missing" };
      if (order.status === "paid") return { outcome: "already_paid", items: order.items };
      if (order.status !== "pending_payment") return { outcome: "closed" };
      if (order.expiresAt <= now) return release(txn, orderId, order, "expired");

      const current = await inventory(txn, order.items);
      for (const item of order.items) {
        const value = current.get(item.productSlug)!;
        await txn.put(inventoryKey(item.productSlug), {
          available: value.available,
          reserved: value.reserved - item.quantity,
        });
      }
      await txn.put(orderKey(orderId), { ...order, status: "paid" } satisfies OrderState);
      return { outcome: "paid", items: order.items, snapshots: await snapshots(txn, order.items) };
    });
  }

  async expire(orderId: string, now: number): Promise<TransitionResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const order = await txn.get<OrderState>(orderKey(orderId));
      if (!order) return { outcome: "missing" };
      if (order.status === "expired") {
        return { outcome: "expired", items: order.items, snapshots: await snapshots(txn, order.items) };
      }
      if (order.status !== "pending_payment") return { outcome: "closed" };
      if (order.expiresAt > now) return { outcome: "too_early" };
      return release(txn, orderId, order, "expired");
    });
  }

  async cancel(orderId: string): Promise<TransitionResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const order = await txn.get<OrderState>(orderKey(orderId));
      if (!order) return { outcome: "missing" };
      if (order.status === "cancelled") return { outcome: "already_cancelled", items: order.items };
      if (order.status === "fulfilled" || order.status === "expired") return { outcome: "closed" };
      if (order.status === "pending_payment") return release(txn, orderId, order, "cancelled");

      const current = await inventory(txn, order.items);
      for (const item of order.items) {
        const value = current.get(item.productSlug)!;
        await txn.put(inventoryKey(item.productSlug), {
          available: value.available + item.quantity,
          reserved: value.reserved,
        });
      }
      await txn.put(orderKey(orderId), { ...order, status: "cancelled" } satisfies OrderState);
      return { outcome: "cancelled", items: order.items, snapshots: await snapshots(txn, order.items) };
    });
  }

  async fulfill(orderId: string): Promise<TransitionResult> {
    return this.ctx.storage.transaction(async (txn) => {
      const order = await txn.get<OrderState>(orderKey(orderId));
      if (!order) return { outcome: "missing" };
      if (order.status === "fulfilled") return { outcome: "already_fulfilled", items: order.items };
      if (order.status !== "paid") return { outcome: "closed" };
      await txn.put(orderKey(orderId), { ...order, status: "fulfilled" } satisfies OrderState);
      return { outcome: "fulfilled", items: order.items };
    });
  }

  async restock(productSlug: string, quantity: number): Promise<StockSnapshot> {
    return this.adjust(productSlug, quantity);
  }

  async adjust(productSlug: string, delta: number): Promise<StockSnapshot> {
    return this.ctx.storage.transaction(async (txn) => {
      const current = await txn.get<InventoryRecord>(inventoryKey(productSlug)) ?? { available: 0, reserved: 0 };
      if (current.available + delta < 0) throw new Error("inventory adjustment would make available stock negative");
      const next = { available: current.available + delta, reserved: current.reserved };
      await txn.put(inventoryKey(productSlug), next);
      return snapshot(productSlug, next);
    });
  }

  async inspect(productSlug: string): Promise<StockSnapshot> {
    return snapshot(productSlug, await this.ctx.storage.get<InventoryRecord>(inventoryKey(productSlug)));
  }
}

async function release(
  txn: DurableObjectTransaction,
  orderId: string,
  order: OrderState,
  status: "cancelled" | "expired",
): Promise<TransitionResult> {
  const current = await inventory(txn, order.items);
  for (const item of order.items) {
    const value = current.get(item.productSlug)!;
    await txn.put(inventoryKey(item.productSlug), {
      available: value.available + item.quantity,
      reserved: value.reserved - item.quantity,
    });
  }
  await txn.put(orderKey(orderId), { ...order, status } satisfies OrderState);
  return { outcome: status, items: order.items, snapshots: await snapshots(txn, order.items) };
}

async function inventory(
  txn: DurableObjectTransaction,
  items: readonly StockItem[],
): Promise<Map<string, InventoryRecord>> {
  const result = new Map<string, InventoryRecord>();
  for (const item of items) {
    if (!result.has(item.productSlug)) {
      result.set(item.productSlug, await txn.get<InventoryRecord>(inventoryKey(item.productSlug)) ?? {
        available: 0,
        reserved: 0,
      });
    }
  }
  return result;
}

async function snapshots(
  txn: DurableObjectTransaction,
  items: readonly StockItem[],
): Promise<readonly StockSnapshot[]> {
  const current = await inventory(txn, items);
  return [...current].map(([productSlug, value]) => snapshot(productSlug, value));
}

function snapshot(productSlug: string, value?: InventoryRecord): StockSnapshot {
  return { productSlug, available: value?.available ?? 0, reserved: value?.reserved ?? 0 };
}

function inventoryKey(productSlug: string): string {
  return `inventory:${productSlug}`;
}

function orderKey(orderId: string): string {
  return `order:${orderId}`;
}

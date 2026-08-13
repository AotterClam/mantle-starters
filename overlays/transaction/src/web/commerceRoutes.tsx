import type { MantleExtensionApp } from "@aotter/mantle/cloudflare";
import { toUrlLocale, type CmsRuntime } from "@aotter/mantle/runtime";
import type { SiteConfig } from "@aotter/mantle/spec";
import type { Child } from "hono/jsx";
import { renderToString } from "hono/jsx/dom/server";
import type { MantleSite } from "../../.mantle/generated/types.js";
import type { Env } from "../mantle/config.js";
import { PageDocument } from "../renderer.js";
import { commerceCopy } from "./messages.js";
import { SitePage } from "./pages/HomePage.js";

const HTML_NO_STORE = {
  "cache-control": "private, no-store",
  "content-type": "text/html; charset=utf-8",
} as const;

type CatalogItem = {
  readonly slug: string;
  readonly title: string;
  readonly priceMinor: number;
  readonly currency: string;
};

type OrderData = MantleSite.Entry_orders;
type PageContext = {
  readonly runtime: CmsRuntime;
  readonly site: SiteConfig;
  readonly locale: string;
  readonly catalog: readonly CatalogItem[];
};

export function mountCommerceRoutes(
  app: MantleExtensionApp<Env>,
  getRuntime: () => Promise<CmsRuntime>,
): void {
  app.get("/:locale/cart", async (c) => {
    const page = await pageContext(getRuntime, c.req.param("locale"));
    if (!page) return c.notFound();
    const copy = commerceCopy(page.locale);
    return html(
      <CommerceDocument page={page} localePath="/:locale/cart" title={copy.cart}>
        <section
          class="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24 lg:px-8"
          data-cart-page
          data-quantity-label={copy.quantity}
          data-remove-label={copy.remove}
        >
          <p class="text-xs font-medium uppercase tracking-wide text-primary">{copy.shop}</p>
          <h1 class="mt-3 text-4xl tracking-tight">{copy.cart}</h1>
          <CatalogData items={page.catalog} />
          <div class="mt-10 space-y-4" data-cart-items></div>
          <p class="mt-8 text-foreground-muted" data-cart-empty>{copy.emptyCart}</p>
          <div class="mt-8 flex items-center justify-between border-t border-border pt-6" data-cart-total-row hidden>
            <strong>{copy.total}</strong>
            <strong class="text-xl" data-cart-total></strong>
          </div>
          <a href={`/${toUrlLocale(page.locale)}/checkout`} class="mt-8 inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground" data-checkout-link hidden>
            {copy.checkout}
          </a>
        </section>
      </CommerceDocument>,
    );
  });

  app.get("/:locale/checkout", async (c) => {
    const page = await pageContext(getRuntime, c.req.param("locale"));
    if (!page) return c.notFound();
    const copy = commerceCopy(page.locale);
    return html(
      <CommerceDocument page={page} localePath="/:locale/checkout" title={copy.checkout}>
        <section class="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <p class="text-xs font-medium uppercase tracking-wide text-primary">{copy.shop}</p>
          <h1 class="mt-3 text-4xl tracking-tight">{copy.checkout}</h1>
          <CatalogData items={page.catalog} />
          <div class="mt-10 rounded-xl border border-border bg-card p-5" data-cart-summary data-empty-label={copy.emptyCart}></div>
          <form class="mt-8 grid gap-5" data-checkout-form data-locale={page.locale} data-error-label={copy.checkoutFailed}>
            <label class="grid gap-2">
              <span class="text-sm font-medium">{copy.name}</span>
              <input name="customerName" required maxLength={120} autocomplete="name" class="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-medium">{copy.email}</span>
              <input name="customerEmail" type="email" required autocomplete="email" class="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label class="grid gap-2">
              <span class="text-sm font-medium">{copy.address}</span>
              <textarea name="shippingAddress" required maxLength={500} autocomplete="street-address" rows={4} class="rounded-lg border border-border bg-background px-3 py-2"></textarea>
            </label>
            <button type="submit" class="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">{copy.placeOrder}</button>
            <p role="status" class="text-sm text-foreground-muted" data-commerce-status></p>
          </form>
        </section>
      </CommerceDocument>,
    );
  });

  app.get("/:locale/pay/:orderToken", async (c) => renderOrderPage(
    getRuntime,
    c.req.param("locale"),
    c.req.param("orderToken"),
    true,
  ));
  app.get("/:locale/orders/:orderToken", async (c) => renderOrderPage(
    getRuntime,
    c.req.param("locale"),
    c.req.param("orderToken"),
    false,
  ));
}

async function renderOrderPage(
  getRuntime: () => Promise<CmsRuntime>,
  localeParam: string,
  orderToken: string,
  payment: boolean,
): Promise<Response> {
  const page = await pageContext(getRuntime, localeParam);
  if (!page || !/^[0-9a-f-]{36}$/u.test(orderToken)) return new Response("Not found", { status: 404 });
  const order = await page.runtime.entryReader.readByDataField({
    collection: "orders",
    field: "orderToken",
    value: orderToken,
  });
  if (!order) return new Response("Not found", { status: 404 });
  const data = order.data as unknown as OrderData;
  const copy = commerceCopy(page.locale);
  const pending = data.orderStatus === "pending_payment" && data.expiresAt > Date.now();
  const title = payment && pending ? copy.fakePayment : copy.order;
  return html(
    <CommerceDocument page={page} localePath={`/:locale/${payment ? "pay" : "orders"}/${orderToken}`} title={title}>
      <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <p class="text-xs font-medium uppercase tracking-wide text-primary">{copy.order} {data.orderNumber}</p>
        <h1 class="mt-3 text-4xl tracking-tight">{title}</h1>
        <p class="mt-4 text-foreground-muted">{statusLabel(data.orderStatus, copy)}</p>
        <div class="mt-10 divide-y divide-border rounded-xl border border-border bg-card px-5">
          {data.items.map((item) => (
            <div class="flex items-center justify-between gap-4 py-4">
              <span>{item.title} × {item.quantity}</span>
              <strong>{money(item.lineTotalMinor, data.currency, page.locale)}</strong>
            </div>
          ))}
          <div class="flex items-center justify-between py-5 text-lg">
            <strong>{copy.total}</strong>
            <strong>{money(data.totalMinor, data.currency, page.locale)}</strong>
          </div>
        </div>
        {payment && pending && (
          <div class="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p class="text-sm text-foreground-muted">{copy.fakePaymentNotice}</p>
            <div class="mt-5 flex flex-wrap gap-3">
              <button type="button" class="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground" data-order-action="pay" data-order-token={orderToken} data-locale={page.locale} data-error-label={copy.orderUpdateFailed}>
                {copy.payNow}
              </button>
              <button type="button" class="rounded-lg border border-border px-5 py-3 font-medium" data-order-action="cancel" data-order-token={orderToken} data-locale={page.locale} data-error-label={copy.orderUpdateFailed}>
                {copy.cancelOrder}
              </button>
            </div>
            <p role="status" class="mt-4 text-sm text-foreground-muted" data-commerce-status></p>
          </div>
        )}
      </section>
    </CommerceDocument>,
  );
}

function CommerceDocument({ page, localePath, title, children }: {
  readonly page: PageContext;
  readonly localePath: string;
  readonly title: string;
  readonly children: Child;
}) {
  return (
    <PageDocument locale={page.locale} title={`${title} · ${page.site.brand}`}>
      <SitePage locale={page.locale} locales={page.site.locales} localePath={localePath} brand={page.site.brand}>
        {children}
      </SitePage>
    </PageDocument>
  );
}

function CatalogData({ items }: { readonly items: readonly CatalogItem[] }) {
  return <div hidden>{items.map((item) => (
    <i
      data-commerce-product
      data-product-slug={item.slug}
      data-product-title={item.title}
      data-price-minor={item.priceMinor}
      data-currency={item.currency}
    ></i>
  ))}</div>;
}

async function pageContext(getRuntime: () => Promise<CmsRuntime>, localeParam: string): Promise<PageContext | null> {
  const runtime = await getRuntime();
  const site = await runtime.siteConfig.load();
  const locale = site.locales.find((value) => toUrlLocale(value) === localeParam.toLowerCase());
  if (!locale) return null;
  return { runtime, site, locale, catalog: await catalog(runtime, locale) };
}

async function catalog(runtime: CmsRuntime, locale: string): Promise<readonly CatalogItem[]> {
  const translations = await runtime.entryReader.readPublished({
    collection: "product-translations",
    locale,
    limit: 100,
  });
  return (await Promise.all(translations.map(async (translation) => {
    const slug = translation.data["slug"];
    if (typeof slug !== "string") return null;
    const parent = await runtime.entryReader.readBySlug({ collection: "products", slug, status: "published" });
    const title = translation.data["title"];
    const priceMinor = parent?.data["priceMinor"];
    const currency = parent?.data["currency"];
    return typeof title === "string" && typeof priceMinor === "number" && typeof currency === "string"
      ? { slug, title, priceMinor, currency }
      : null;
  }))).filter((item): item is CatalogItem => item !== null);
}

function html(children: Child): Response {
  return new Response(renderToString(children), { headers: HTML_NO_STORE });
}

function money(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
}

type Copy = ReturnType<typeof commerceCopy>;

function statusLabel(status: OrderData["orderStatus"], copy: Copy): string {
  return ({
    pending_payment: copy.pendingPayment,
    paid: copy.paid,
    fulfilled: copy.fulfilled,
    cancelled: copy.cancelled,
  })[status];
}

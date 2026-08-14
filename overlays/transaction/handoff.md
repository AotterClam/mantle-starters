# Transaction overlay

Use this when the launch type intent is `transaction`.

Public URL surface:

- `/{locale}` — localized home;
- `/{locale}/products` and `/{locale}/products/{slug}` — product list and single;
- `/{locale}/pages` and `/{locale}/pages/{slug}` — page list and single;
- `/{locale}/cart`, `/{locale}/checkout`, and `/{locale}/pay/{orderToken}` — guest purchase flow;
- `/sitemap.xml`, `/llms.txt`, and localized markdown mirrors come from Core.

First useful workflow:

- show published `product-translations` joined to shared `products` fields;
- keep the cart in browser storage and verify price/currency again on the server;
- reserve and mutate stock through `InventoryCoordinator`;
- create operational orders, simulate payment, and expose row-bound inventory/order actions in Admin and through `/mcp/staff`;
- expire abandoned orders through Queue, with Cron as recovery.

Lifecycle references in `manifests/site.yaml`:

- `products` and `page` own shared identity fields;
- `product-translations` and `page-translations` own localized public copy;
- all four use `publishing`: staff draft and publish both identity and language versions;
- `orders`, `inventory`, and `inventory-movements` use `operational`: they are
  live business records and never enter draft, review, or publish states.

Do not add an `editorial` starter example yet. Core accepts the grammar, but
`request_publish` still blocks the approval runtime needed for a working
review flow.

## Replacing the demo payment

Choose one provider first. Do not add a generic payment-provider interface
until this shop actually needs two providers.

- Keep `place-order` as the server-priced reservation boundary.
- Remove the public `pay-order-http` Trigger and the browser's fake-pay action;
  knowing an order token must never count as proof of payment.
- Put provider API/signature code in `src/commerce/stripe.ts` or
  `src/commerce/ecpay.ts`, and add its secret fields to `Env` in
  `src/mantle/config.ts`. Store values only in `.dev.vars` and Worker secrets.
- Mount the provider callback in `src/web/typeRoutes.ts`. Stripe needs the raw
  request body and signature header; ECPay posts form data and expects its own
  acknowledgement body, so neither callback belongs in Mantle's JSON HTTP
  Trigger path.
- Verify the provider callback before invoking the internal `pay-order`
  Procedure. Keep the inventory/order transition in
  `src/commerce/handlers.ts`; do not call its handler directly or write Mantle
  tables from the callback route.
- Treat callbacks as retries: preserve the first `paidAt`, store the selected
  provider's transaction/event reference when adding its fields, and prove a
  duplicate callback cannot deduct inventory twice.
- Provider return/success URLs are customer navigation only. Only the verified
  server callback may confirm payment.

Customer accounts remain out of scope.

Keep one `InventoryCoordinator` per provisioned shop so a multi-product cart
reserves atomically. Split by SKU only after measured single-shop throughput
requires a distributed reservation workflow.

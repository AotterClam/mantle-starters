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

Replace the fake payment action only when a real provider and its webhook
verification contract are selected. Customer accounts remain out of scope.

Keep one `InventoryCoordinator` per provisioned shop so a multi-product cart
reserves atomically. Split by SKU only after measured single-shop throughput
requires a distributed reservation workflow.

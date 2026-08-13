# Transaction overlay

Use this when the launch type intent is `transaction`.

Public URL surface:

- `/{locale}` — localized home;
- `/{locale}/products` and `/{locale}/products/{slug}` — product list and single;
- `/{locale}/pages` and `/{locale}/pages/{slug}` — page list and single;
- `/sitemap.xml`, `/llms.txt`, and localized markdown mirrors come from Core.

First useful workflow:

- show published `product-translations` joined to shared `products` fields;
- use `/api/product-inquiries` as the temporary intent-capture endpoint;
- do not build cart, payment, inventory, accounts, or admin flows until
  the user asks for them.

Lifecycle references in `manifests/site.yaml`:

- `products` and `page` own shared identity fields;
- `product-translations` and `page-translations` own localized public copy;
- all four use `publishing`: staff draft and publish both identity and language versions;
- `product-inquiries` uses `operational`: submissions are live immediately
  and never enter draft, review, or publish states.

Do not add an `editorial` starter example yet. Core accepts the grammar, but
`request_publish` still blocks the approval runtime needed for a working
review flow.

Move to real checkout only after the site deploy and first product
surface are working.

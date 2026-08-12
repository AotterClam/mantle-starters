# Transaction overlay

Use this when the launch type intent is `transaction`.

First useful shape:

- show a small published product list from `public-products`;
- use `/api/product-inquiries` as the temporary intent-capture endpoint;
- do not build cart, payment, inventory, accounts, or admin flows until
  the user asks for them.

Lifecycle references in `manifests/transaction.yaml`:

- `products` uses `publishing`: staff draft and publish catalog content;
- `product-inquiries` uses `operational`: submissions are live immediately
  and never enter draft, review, or publish states.

Do not add an `editorial` starter example yet. Core accepts the grammar, but
`request_publish` still blocks the approval runtime needed for a working
review flow.

Move to real checkout only after the site deploy and first product
surface are working.

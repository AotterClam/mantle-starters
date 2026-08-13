# Transaction seed prompt

Use `.mantle/overlays/transaction/seed.json` as the local, auth-free first
content surface. Replace its parent `products` plus localized
`product-translations`, and its parent `page` plus localized
`page-translations`, for `{{BRAND}}`; keep integer `priceMinor`, one currency,
short summaries, and no fake payment claims. Runtime content authoring moves to
Staff MCP after auth is configured. Create a sample inquiry only if the user
wants a form smoke.

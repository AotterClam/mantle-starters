# Transaction seed prompt

Use `.mantle/overlays/transaction/seed.json` as the local, auth-free first
content surface. It contains shared Page/Product parents and locale packs for
their translations; `.mantle/overlays/transaction/messages.json` contains the
matching functional UI copy. Provision keeps only the selected locales.
Replace the sample product for `{{BRAND}}`; keep integer `priceMinor`, one
currency, and short summaries. Restock products through Staff MCP before checkout. The
included payment screen must stay labeled as a simulation; orders and inventory
changes are real operational data. Runtime content authoring and order operations
move to Staff MCP after auth is configured.

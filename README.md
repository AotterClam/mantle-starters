# mantle-starters

Deterministic provision bundles for Mantle sites.

`blank/` is the minimal headless base. `overlays/<type>/` adds only the
manifest, product notes, UI, and custom business logic selected by that type.
`provision-bundles/*.json` are immutable generated artifacts consumed by both
Mantle Landing and local materialization.

The generated application boundary is intentionally small:

```text
manifests/<type>.yaml       product/data/API contract
src/index.ts               minimal Cloudflare Worker entry
src/handlers.ts            only for referenced custom Procedures
src/<service-or-route>.ts  only for selected product behavior
.mantle/generated/         reproducible manifest and binding types
```

Core owns the common Worker, storage, auth, routing, MCP, and cache assembly.
Generated projects may still use its public low-level Cloudflare exports when
custom composition is warranted.

`recipes/minimal-page.html` is a checked, zero-dependency selected-source eject
for a headless site. Copy it into `public/index.html`, enable Wrangler's
`assets.directory`, then own and edit it like any shadcn-style source copy.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build:provision-bundle
pnpm check:provision-bundle
pnpm smoke:provision-bundle
pnpm check:starter-locks
pnpm check:repo-local-skills
pnpm check:core-skills
pnpm materialize transaction --out ../my-site
```

Edit `blank/` or an overlay, then rebuild the bundles. Do not hand-edit files
under `provision-bundles/`.

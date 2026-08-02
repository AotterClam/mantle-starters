# Mantle blank source

This directory is the headless source used to build immutable provision
bundles. Materialize a bundle from the repository root; a raw `blank/` copy is
not a provisioned project.

A generated blank site has only two normal attention points:

- `manifests/site.yaml` — data and API contract;
- `src/index.ts` — the minimal Cloudflare Worker entry.

Add `src/handlers.ts` only when a manifest references custom business logic.
Core owns the standard D1/KV/Auth/Admin/REST/Trigger/OAuth/MCP assembly and
cache boundary. Developers can still use the public low-level exports from
`@aotter/mantle/cloudflare` when an application needs custom composition.

From the repository root:

```bash
pnpm build:provision-bundle
pnpm materialize blank --out ../my-site
pnpm smoke:provision-bundle
```

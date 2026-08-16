# {{BRAND}}

{{DESCRIPTION}}

This is the headless Mantle base: one authored manifest, one generated RuntimePlan
module, Core's explicit-mode conventional Auth, and one Worker entry using the
Cloudflare facade. It contains no visitor UI or component tree.

Launch facts live in `.mantle/launch-state.json`; the coding-agent handoff is
`.mantle/handoff.md`.

## Start locally

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

`GET /api/views/published-notes` boots against an empty local D1 database.
`/admin` and `/mcp/staff` remain unavailable until hosted or self-managed auth
is configured; public View routes do not require auth.

## Project-owned files

- `manifests/site.yaml` — Schema and View source of truth.
- Hosted/self-managed Auth is selected from environment variables by Mantle Core.
- `src/index.ts` — Worker entry and site defaults.
- `wrangler.toml` — Cloudflare bindings and deployment identity.

`.mantle/generated/` and projected skills are reproducible machine-owned
outputs. Regenerate them with `pnpm generate` and `pnpm skills` from the
installed Mantle version; do not copy instructions from a floating branch.

## Extend or eject

Add custom handlers or routes through `createMantleWorker` first. For complete
Worker ownership, follow the version-matched low-level composition document at
`node_modules/@aotter/mantle/docs/cloudflare-low-level-composition.md`.

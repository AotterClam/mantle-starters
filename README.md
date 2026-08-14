# mantle-starters

Blank-first starter source for Mantle provisioning.

Current launch contract:

- `blank/` is the headless first-launch base and uses Core's conventional
  Worker facade.
- `recipes/typed-web/` is the shared source for typed sites; each bundle keeps
  only the runtime surface selected by its archetype.
- `provision-bundles/<type>.json` are generated artifacts used by landing and
  local cold starts.
- `overlays/<type>/` contains small type intent overlays applied while
  building each matching bundle.
- No first-run theme picker or full archetype starter fork is required to
  boot.

## Current UI implementation (replaceable)

This revision uses free [Kiwa UI](https://kiwaui.com/) source. Typed bundles
keep selected runtime components plus the complete pinned `kiwa/` snapshot as
an offline coding-agent palette; no registry access is required. This is an
implementation and credit boundary, not the Starter layering contract. A
future UI-library swap should replace the recipe and its Kiwa-specific bundle
guards together.

Generated `blank` repos expose only the authored model and Worker entry:

```txt
manifests/site.yaml
src/index.ts
.mantle/generated/
public/site-icon.svg
wrangler.toml
```

Typed bundles additionally own their Hono JSX UI and selected behavior:

```txt
src/index.ts          Worker fetch entrypoint
src/renderer.tsx      Hono JSX document renderer
src/worker/           optional type-specific server behavior
src/web/              public JSX page, seed-driven content, browser client JS
src/mantle/           site defaults and selected handler registry
manifests/site.yaml   4 atoms: Schema, View, Procedure, Trigger
components/ lib/      selected runtime-facing Kiwa surface
kiwa/                  complete offline reference palette; not runtime source
styles/               Kiwa/Tailwind source
public/               Cloudflare Static Assets: site icon, CSS, JS, SVG
```

`mantle generate` also materializes the version-matched Admin SPA under
`public/_mantle/admin/`; that generated directory stays out of git.

The 4 atoms stay in root `manifests/site.yaml` because they are project config,
not Worker route code. Type overlays may add server behavior under
`src/worker/features/<feature>` and register Mantle Procedure handlers through
the typed recipe's handler registry.

Kiwa source is MIT licensed; keep `kiwa/LICENSE` and `kiwa/manifest.json`
while this implementation is present. Runtime code must not import from the
reference palette.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build:provision-bundle
pnpm check:provision-bundle
pnpm materialize presence --out ../my-site --brand "My Site"
pnpm check:kiwa
pnpm check:repo-local-skills
pnpm check:starter-locks
pnpm typecheck
pnpm test
```

Refresh the current Kiwa snapshot:

```bash
node scripts/sync-kiwa.mjs
```

## Shape

```txt
blank/
recipes/
  typed-web/
overlays/
  presence/
  intake/
  publication/
  transaction/
  reservation/
  community/
kiwa/
provision-bundles/
  blank.json
  presence.json
  intake.json
  publication.json
  transaction.json
  reservation.json
  community.json
scripts/
  build-provision-bundle.mjs
  sync-kiwa.mjs
```

Maintain bundles by editing `blank/`, `recipes/typed-web/`,
`overlays/<type>/`, or `kiwa/`, then
running `pnpm build:provision-bundle`. Do not hand-edit generated
`provision-bundles/*.json`.

`pnpm materialize <type> --out <dir>` writes one generated bundle to a local
project directory without installing dependencies, creating a remote repo, or
touching Cloudflare. The output directory must be empty.

The blank README comes directly from `blank/README.md`. Typed READMEs combine
the typed recipe with the selected overlay's `handoff.md` and `layout.md`.

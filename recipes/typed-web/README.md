# `mantle-starters/recipes/typed-web`

> **This README ships with your materialized project.** If you're reading
> it on GitHub at `aotter/mantle-starters/recipes/typed-web`, the
> Getting-started block below **does not work on a raw clone** —
> `src/mantle/config.ts` contains literal `{{BRAND}}` / `{{LOCALES}}` /
> `{{DESCRIPTION}}` placeholders that the provision flow substitutes.
>
> **To evaluate this starter end-to-end**, run `pnpm materialize <type>
> --out <dir>` from the repository root, or use Mantle landing for the
> hosted GitHub and Cloudflare flow.

**Shared typed-site recipe.** The bundle builder selects the sections,
browser behavior, handlers, and manifest required by one archetype, then
wires them through Core's conventional Worker facade.

Type-specific bundles include the selected manifest, overlay notes, and
seed prompt up front. Continue from `.mantle/handoff.md` in the generated
project.

## Kiwa UI Credit

`components/` and `lib/` contain this revision's selected runtime-facing
[Kiwa UI](https://kiwaui.com/) surface. If `kiwa/` exists, it is this Starter
revision's offline reference palette and provenance record, not a permanent
typed-project contract or runtime source. Follow `mantle:theme` when adopting
a palette item or replacing the UI implementation.

## Project shape

```txt
src/
  index.ts                    # Worker fetch entrypoint
  renderer.tsx                # Hono JSX document renderer
  worker/
    routes/
      home.tsx                # public homepage extension route
      assets.ts               # selected CSS and browser assets
    features/                 # type overlays add server behavior here
  web/
    pages/HomePage.tsx        # public page body
    content/                  # seed-driven site/home content modules
    client/                   # browser behavior served as /assets/kiwa-home.js
  mantle/
    config.ts                 # environment and site defaults
    handlers/index.ts         # Procedure handler registry

manifests/                    # 4 atoms: Schema, View, Procedure, Trigger
components/, lib/, styles/     # selected runtime-facing UI surface
kiwa/                         # current revision's optional offline UI palette
.mantle/generated/            # generated manifest/types consumed by Worker
.mantle/                      # launch state, overlay notes, handoff
```

`manifests/` is the authoritative Mantle model. `mantle generate` compiles it
to `.mantle/generated/`; `src/index.ts` passes that output to
`createMantleWorker`. In this revision, runtime components stay at root
because `kiwa-ui.json` uses Kiwa's `@/components` and `@/lib/utils`
convention.

## URL surface

```
GET  /api/views/<name>            view REST per View atom
METHOD <trigger path>             manifest-declared HTTP Trigger routes
ALL  /mcp/staff                   Staff MCP JSON-RPC dispatcher
ALL  /mcp                         User/read MCP JSON-RPC dispatcher
```

No public read routes (`/{locale}/...`, `/sitemap.xml`, `.md` mirrors,
`llms.txt`). Add `mountPublicRoutes` from
`@aotter/mantle/cloudflare` only together with matching templates and a
`publicPathResolver`; Core does not auto-publish every Schema.

### Auth

MCP requests must carry a verified bearer token. The runtime's
Cloudflare adapter now uses Better Auth for browser sign-in and MCP
OAuth/DCR. This starter wires the dual MCP surface (`/mcp/staff` for
staff authoring, `/mcp` for end-user/read tools), but ships only a small
public homepage for `/`. Add your own frontend and policy surface before
claiming a custom production workflow.

## Getting started

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
```

> `--frozen-lockfile` matches what CI runs. Without it a local install
> can quietly regenerate `pnpm-lock.yaml` against any dep version
> published since the lockfile was committed; the drift only surfaces
> when CI rejects it.

The seeded `/` preview and public HTTP Procedures work without auth. Set
`MANTLE_AUTH_MODE=hosted` with `MANTLE_HOSTED_AUTH_ISSUER`,
`MANTLE_HOSTED_AUTH_CLIENT_ID`, and `ADMIN_GITHUB_LOGIN`. Hosted clients are
public PKCE clients and have no client secret.
Set `MANTLE_AUTH_MODE=self-managed` with `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, and `ADMIN_GITHUB_LOGIN`. Configure only the selected path
when you want to exercise `/api/auth/*` or Staff MCP locally. Then:

```bash
pnpm dev      # safe wrangler dev — http://localhost:8787
```

Open `http://localhost:8787/`, then inspect
`manifests/{{ARCHETYPE}}.yaml` for the selected View and Procedure names.
The homepage starts from `.mantle/overlays/{{ARCHETYPE}}/seed.json`; content
created later through Staff MCP lives in D1.

For production, push the generated repo and configure Cloudflare, or use
Mantle landing to automate the GitHub and Cloudflare steps.

`/admin`, `/api/auth/*`, and Staff MCP need either Mantle Platform hosted
auth or self-hosted GitHub OAuth. The public homepage does not.

## Editing the launch

1. Edit `.mantle/overlays/{{ARCHETYPE}}/seed.json` for auth-free local copy.
2. Edit `manifests/{{ARCHETYPE}}.yaml` when the Schema, View, Procedure, or
   Trigger contract changes, then run `pnpm generate`.
3. Register only ref Procedure handlers in `src/mantle/handlers/index.ts`;
   builtin handlers come from Core.
4. Validate with `pnpm validate` (runs the spec CLI in preview phase — grammar + cross-Schema only). Before deploying, run `pnpm validate:deploy` (= `mantle validate --phase deploy`) for production-only checks. `pnpm run deploy` chains it in front of `wrangler deploy` automatically.

## What you get from the npm packages

`@aotter/mantle/cloudflare` mounts the routes above against
`@aotter/mantle/runtime` use cases. Nothing is starter-specific
once you've wired the bindings — bearer-token MCP auth, view executor,
and HTTP Trigger dispatcher all come straight from the runtime packages.

If your frontend renders posts (or anything you'd like to expose for
LLM crawlers), the runtime can ship an `.md` mirror of any entry; see
`@aotter/mantle/runtime/serializeEntryAsMarkdown` and
`composeLlmsTxt`.

# mantle-starters agent notes

This is the starter monorepo, not a generated consumer project.

Keep changes minimal and deterministic. Reuse the existing bundle and
materialization paths instead of introducing parallel abstractions.
Prefer removing obsolete code when safe. Do not revive the legacy
full-starter/theme path.

Current contract:

- Landing and local cold starts materialize the same
  `provision-bundles/<type>.json`.
- `blank/` owns the shared generated repo base, including repo-local
  Mantle skills.
- `overlays/` are source inputs applied while building each type bundle.
- Non-headless overlays add only selected UI or business source. Do not put
  generic Worker assembly back into generated repos.

Useful checks:

```bash
pnpm build:provision-bundle
pnpm check:provision-bundle
pnpm check:repo-local-skills
pnpm check:core-skills
pnpm check:starter-locks
pnpm smoke:provision-bundle
```

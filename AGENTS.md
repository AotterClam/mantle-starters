# mantle-starters agent notes

This is the starter monorepo, not a generated consumer project.

Keep changes minimal and deterministic. Reuse the existing bundle and
materialization paths instead of introducing parallel abstractions.
Prefer removing obsolete code when safe. Do not revive the legacy
full-starter/theme path.

Before changing versions, tags, release workflows, or release tarball URLs,
read the repo-local
[`mantle-starters-release` skill](.claude/skills/mantle-starters-release/SKILL.md).

Current layering contract:

- Landing and local cold starts materialize the same
  `provision-bundles/<type>.json`.
- `blank/` owns the shared generated repo base, including repo-local
  Mantle skills.
- `overlays/` are source inputs applied while building each type bundle.

The current, replaceable UI implementation uses Kiwa. Runtime files are
selected per type grammar; typed bundles copy the complete `kiwa/` palette
unchanged for offline reference and provenance; headless blank copies none.
These are revision-specific guards, not the blank/typed/overlay architecture.

Useful checks:

```bash
pnpm build:provision-bundle
pnpm check:provision-bundle
pnpm check:kiwa
pnpm check:repo-local-skills
pnpm check:starter-locks
pnpm typecheck
pnpm test
```

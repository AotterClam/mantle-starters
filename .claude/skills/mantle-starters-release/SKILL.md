# Mantle Starters Release Skill

Use this skill for any `mantle-starters` release or Starter version bump.

## Required Reading

Read these files before changing versions, tags, release workflow files,
or release tarball URLs:

- `.github/workflows/bump-from-sdk.yml`
- `.github/workflows/validate.yml`
- `package.json`

For full controller context, also inspect the Core checkout:

- `../mantle`

## First Principle

Normal Starter feature and release work lands on `develop`. The validated
release merge commit receives the immutable `v*` tag. `main` is not part of
the pre-v0.1 alpha path. Do not hand-edit public release assets, retag an
existing public version, or repair a published tarball in place.

If a public tarball is incomplete, fix forward with the next aligned
Mantle alpha.

## Changing Release Automation

Before code, open a Draft PR with a finite state table, its invariants and
non-goals, and the single mutation boundary and recovery path for each external
resource. Freeze one commit SHA for review. Every finding must name the state
row, concrete event interleaving, and wrong mutation; a clean verdict expires
when the SHA changes. After two patch rounds, return a new foundational blocker
to the state table and user instead of continuing a local redesign loop.

## Normal Release Path

1. Merge required starter content into `develop`.
2. Run the Core release controller from `../mantle`. It completes the exact
   packed pre-tag gate, creates the Core tag, and publishes npm artifacts.
3. Let Core dispatch `bump-from-sdk.yml` with the version, exact Core SHA, and
   exact Starter SHA that passed the packed pre-tag gate. There is no separate
   manual Starter release entry point; retry the Core controller to resume.
4. The worker bumps versions, standalone locks, projected Core skills,
   provision bundles, and the private root package's exact Core SHA. Starter
   CI reads that SHA before checkout.
5. The worker requires the named release gates, merges only the checked head
   into `develop`, and tags that exact merge commit.
6. Core checks out the Starter tag and repeats the gate against the published
   npm packages. Landing moves only when the Core controller was explicitly
   invoked with that option.

`RELEASE_FANOUT_TOKEN` is Starter-only: grant pull-request write access to
`aotter/mantle-starters` plus GitHub's required metadata read, with no Contents
write, Landing, or other repository scope.
It is exposed only to PR creation, so install and build scripts cannot read it.
Repository merges, pushes, and tags use the job-scoped `GITHUB_TOKEN`.
A separate token is needed because
PRs created by `GITHUB_TOKEN` do not trigger pull-request validation.

## Pre-Merge Gate For Starter Feature PRs

Run the smallest relevant local gate before opening or merging a feature
PR:

```bash
pnpm check:starter-locks
```

## Release Evidence

The Core controller owns this gate. If investigating it manually, use a clean
detached checkout of the tag; do not run these checks against the current
branch and call them tag evidence:

```bash
git clone --branch vX.Y.Z --depth 1 https://github.com/aotter/mantle-starters.git ../mantle-starters-vX.Y.Z
cd ../mantle-starters-vX.Y.Z
pnpm install --frozen-lockfile
pnpm check:starter-locks
pnpm check:provision-bundle
pnpm check:packed
```

## Red Flags

Stop and explain the situation if any of these appear:

- A release PR targets `main` or tries to merge/backport `main` into `develop`.
- The private root package or `.github/workflows/validate.yml` does not pin and
  consume the exact released Core SHA before checkout.
- The dispatch's Starter SHA is not the current `develop` base for a fresh
  release PR.
- A tarball URL points to a version that has not been tagged yet and no
  matching SDK release is planned.
- Landing was dispatched without the Core controller's explicit option.
- A production handoff points at a floating branch or local URL instead
  of a tagged release asset.

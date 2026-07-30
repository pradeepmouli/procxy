# Development & Release Process

## Branch model

- `develop` — integration branch. All feature/fix work merges here first.
- `master` — release branch. Kept in sync with `develop` via a standing "Sync develop into master" PR.

Work happens on short-lived branches off `develop`, merged via PR. Once `develop` is in a good state, the develop→master PR is merged to promote it.

## Adding a changeset

Any user-facing change (bug fix, feature, breaking change) needs a changeset:

```bash
pnpm changeset
```

This is a single-package repo, so the prompt just asks for a bump type (patch/minor/major) and a summary. Commit the generated `.changeset/*.md` file alongside your change.

If you forget, the "Auto-generate Changeset" workflow (`.github/workflows/changeset.yml`) will synthesize one from your commit messages when your PR opens/updates — but a hand-written changeset with a real summary is always better for the CHANGELOG.

## Release automation (fully automatic once a changeset lands)

The `Release` workflow (`.github/workflows/release.yml`) runs on every push to `develop` or `master`. When it finds pending changesets, it:

1. Opens or updates a **"chore: version packages"** PR from `changeset-release/<branch>` targeting that same branch. This PR contains the version bump + CHANGELOG update — don't edit it by hand, just let it accumulate changesets.
2. Attempts to enable GitHub's native auto-merge on that PR (needs "Allow auto-merge" on in repo settings — if it's off, the PR just sits there and needs a manual merge).
3. When that Version Packages PR merges, the *next* run of the Release workflow (triggered by that merge) runs `pnpm changeset:publish`, which publishes the bumped package to npm with provenance (`NPM_CONFIG_PROVENANCE: true`).

So: merge your PR to `develop` → Version Packages PR appears → merge it (or let auto-merge do it) → package publishes. No manual `npm publish` ever.

The `Release` job uses **Node 22** specifically — keep this in sync with any other repo's release.yml if you copy the workflow around; a stale Node version here is a real way to break the Release build without CI (which runs on 24.x/26.x) ever noticing.

## CI

`.github/workflows/ci.yml` runs the matrix (Node 24.x, 26.x): install, build, type-check, test, lint. `CodeQL` and `Dependency Security Audit` run as separate checks on the same PR.

If CodeQL flags something and you're confident it's a false positive (e.g. spawning real child processes for IPC tests can trip patterns that look like insecure subprocess handling but aren't), dismiss it from the repo's Security → Code scanning tab with a specific reason — don't silence it in code just to turn the check green.

Note: this repo's test suite spawns real child processes for IPC integration tests, so an occasional single flaky failure on an otherwise-green run is a known characteristic, not a regression — rerun before digging in.

## Local commands

```bash
pnpm install --frozen-lockfile   # match CI exactly
pnpm build
pnpm test
pnpm type-check
pnpm lint
```

`pnpm run <script>` and `pnpm --filter <pkg> <script>` re-verify the lockfile against pnpm's `minimumReleaseAge` policy even with a fresh install — this repo sets `minimumReleaseAge: 0` in `pnpm-workspace.yaml` so a freshly-published transitive dependency never blocks a local install or CI run.

If a git hook (pre-commit/pre-push) is getting in the way of something you've already verified manually, bypass it with `SKIP_SIMPLE_GIT_HOOKS=1` rather than `--no-verify` — it's the hook's own documented escape hatch and shows up explicitly in its output.

## Current gap: branch protection

Branch protection on `master`/`develop` is currently **disabled** (as of 2026-07-30) — the auto-changeset bot's `GITHUB_TOKEN` couldn't push past it (only `RELEASE_TOKEN`, a real user PAT, can), and GitHub's newer Rulesets don't support bot bypass on personal (non-org) repos either. If you re-enable protection, expect the `Auto-generate Changeset` workflow to start failing again unless you also switch it to use `RELEASE_TOKEN` (or an equivalent PAT/GitHub App) instead of the default `GITHUB_TOKEN`.

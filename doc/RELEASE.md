# Release Guide

The project now ships via npm and GitHub Releases with provenance-enabled builds. This guide captures the maintainer flow.

## Prerequisites

- `NPM_TOKEN` secret configured in GitHub with publish rights for the `orcka` package.
- Local environment must have a clean git working tree and passing checks.

## Local Steps

1. Pull the latest `main`.
2. Run `task release` (optionally override `SEMVER=minor` or `SEMVER=major`).
   - Runs checks (`type-check`, `lint`, unit + contract tests, build).
   - Executes `npm version <semver>` to bump the version, commit, and tag.
   - Pushes `main` and the new `v*` tag.

> Tip: If you prefer a dry-run, run `task check` first, then `npm version --no-git-tag-version <semver>` to preview the changes.

## Continuous Delivery

The tag push triggers `.github/workflows/release.yml`, which:

1. Installs dependencies and reruns the full check/test matrix.
2. Builds the CLI binary and captures `bin/orcka.cjs`.
3. Packs `orcka-<version>.tgz` via `pnpm pack`.
4. Publishes to npm using the repo-scoped `NPM_TOKEN`.
5. Creates a GitHub release with both artefacts attached.

If the workflow publishes successfully, the package is immediately available via `pnpm add orcka`, and binaries remain downloadable from the release page.

## Troubleshooting

- **Missing `NPM_TOKEN`**: The workflow skips publishing when the secret is absent or when running on a fork.
- **Version already published**: Increment the version locally (`npm version patch`, etc.) and push a new tag.
- **Publish failures**: Check the workflow logs and rerun the job once the underlying issue is fixed. Remember that npm disallows republishing the same version.

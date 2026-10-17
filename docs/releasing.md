# Releasing

Three packages are published, always at the **same version**:

| Package                     |                        |
| --------------------------- | ---------------------- |
| `@starktech/velo`           | the CLI                |
| `@starktech/velo-api`       | the optional API       |
| `@starktech/velo-dashboard` | the optional dashboard |

`@starktech/core` is private; its code is bundled into each of them. Because they are separate
installs that must work together, they are released together, and they warn when they drift apart
(`velo status` and the dashboard banner) using this rule: before 1.0, versions are compatible when
major **and minor** match; from 1.0, when major matches. So before 1.0, bump the **minor** for
anything that changes the API or CLI behaviour, and the patch for fixes.

## Cutting a release

```bash
# 1. green locally
npm ci && npm run lint && npm run build && npm test
scripts/smoke-pack.sh                       # installs the packed tarballs like a user would

# 2. set the version everywhere (root + 3 packages + package-lock.json) and commit
npm run version:set -- 0.2.0
git commit -am "release 0.2.0"

# 3. tag and push; the Release workflow does the rest
git tag v0.2.0
git push --follow-tags
```

The `Release` workflow (`.github/workflows/release.yml`) then:

1. **verify**: checks the tag equals every package's version (`npm run version:check -- <tag>`),
   then lint, build, tests, `npm audit --omit=dev`, and the packed-install smoke test;
2. **publish** (waits for approval if the `npm` environment requires reviewers): publishes
   `velo-api`, then `velo-dashboard`, then `velo` (companions first, so the CLI never points at
   packages that don't exist yet), each with `--provenance`;
3. creates a GitHub release with generated notes.

A version containing a `-` (`v0.2.0-beta.1`) is published under the `next` dist-tag and marked a
pre-release on GitHub, so `npm install -g @starktech/velo` doesn't pick it up; try it with
`npm install -g @starktech/velo@next`.

## One-time setup

1. **npm scope.** The releaser must own the `@starktech` scope on npm (a user or organisation named
   `starktech`), with two-factor authentication on.
2. **Token.** Create a granular access token on npmjs.com with read/write on the `@starktech` scope
   (a token for the first publish can't be limited to individual packages, because they don't exist
   yet).
3. **GitHub.** In the repository settings create an environment named **`npm`**, add the token as
   its secret **`NPM_TOKEN`**, and add yourself as a required reviewer so a pushed tag can't publish
   without a click. The repository must be public for npm provenance to be accepted.
4. After the first publish you can switch each package to npm's _trusted publishing_ (GitHub
   Actions as a trusted publisher) and delete the token; the workflow already has the
   `id-token: write` permission it needs.

## What guards a release

`scripts/smoke-pack.sh` (also run by CI on every push, in the `packaged install` job) packs the
three tarballs and installs them into an empty prefix with `npm install -g`, then drives the
installed commands: version, init/log/list/export, `velo start`, the API and dashboard endpoints,
the CLI seeing events created through the API, `velo stop`, and the CLI installed **alone** (the API
and dashboard really are optional; `velo api start` tells you how to install them). It also fails if
a tarball contains source maps, sources or tests, lacks LICENSE or README, or depends on anything
unpublished (like `@starktech/core`). It needs network access (npm installs `better-sqlite3`) and
uses a temp data directory and free ports.

`.github/workflows/ci.yml` runs lint, build, tests and `npm audit --omit=dev` on Ubuntu with Node 24, plus
that smoke test (the release workflow runs the same checks first). The packages declare
`engines.node >=22`, but only Node 24 is tested in CI; run `nvm use 22 && npm test` before a release if
you want to be sure of the floor.

## If something goes wrong

- **Check what would be published**, without publishing: `npm pack --dry-run -w @starktech/velo`
  (lists the files) and `npm publish --dry-run -w @starktech/velo`.
- **A publish failed part way** (say `velo-api` is out but `velo` isn't): npm won't republish a
  version. Publish only the missing ones by hand from the tagged commit, with the same flags the
  workflow uses (`npm publish -w <package> --access public --provenance`, which needs the CI
  environment; locally drop `--provenance`), or release the next patch version.
- **Bad release**: `npm deprecate '@starktech/velo@0.2.0' "use 0.2.1"` for each package. Unpublishing
  is only possible for 72 hours and breaks anyone who installed it.
- **Re-running the verify job** is always safe; it publishes nothing.

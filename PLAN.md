# Velo migration plan

Port of `../busybee-x` (Next.js + Postgres) into the velo monorepo: simpler, SQLite-only, with
optional packages.

## Decisions (confirmed)

| Topic | Decision |
| --- | --- |
| Users | Single-user. Drop user/team/channel metadata, Slack, Docker, lambda, infra from busybee-x. |
| API security | Binds `127.0.0.1`, **no auth**. Host/port configurable; document the risk if a non-loopback host is set. |
| Autostart | macOS (launchd LaunchAgent) + Linux (`systemd --user`). Windows out of scope. |
| Data import | One-off importer: busybee-x CSV and Postgres. |
| Branding | UI looks the same as busybee-x; product name becomes **velo** (was "chrono"). |

## Target layout

```
packages/
  core/       @starktech/core       business logic, SQLite, config, types (bundled into the others)
  cli/        @starktech/velo       terminal UI, the main interface; manages api/dashboard
  api/        @starktech/velo-api   Express API (published)
  dashboard/  @starktech/velo-dashboard   React + Vite SPA (published)
```

- `core` stays private/unpublished; `cli` and `api` bundle it with esbuild (current approach for `cli`).
- `api` and `dashboard` are **optional**: `cli` works with neither installed. The CLI never imports
  them; it resolves them at runtime (`require.resolve` / global bin lookup) and spawns their bins.
- Package names assume the `@starktech` scope; confirm they're available on npm before Phase 6.

---

## Phase 0: Baseline and dependency upgrade

Current state: 45 audit findings (2 critical, 27 high). Almost all trace to the uncommitted change in
`package.json` that **downgraded `jest` from ^30.2.0 to ^25.0.0** (pulls in `request`, `tough-cookie`,
`js-yaml`, old `uuid`). This looks accidental.

1. Decide what to do with the uncommitted edits: keep `rootDir` in `packages/cli/tsconfig.json` and the
   esbuild bump; revert the jest downgrade; move `esbuild` out of root `dependencies` into
   `devDependencies` (build tool only).
2. Upgrade within semver ranges first: `eslint`, `prettier`, `typescript-eslint`, `knex` 3.3,
   `zod` 4.6, `ts-jest` 29.4, `@types/node`, `eslint-plugin-prettier`.
3. Major bumps, one commit each with tests green: `jest` 30, `better-sqlite3` 13 (native module, check
   Node 22 prebuilds), `commander` 15, `uuid` 14 (or drop it if Node's `crypto.randomUUID` suffices;
   note v7 IDs need `uuid`). Hold `typescript` at 5.9 until `typescript-eslint` and `ts-jest` support 7.
4. `npm audit` should reach zero or only documented, unreachable dev-only findings. Re-run
   `build`, `lint`, `test`, and a smoke test of the CLI against a temp DB.
5. Add `engines.node >=22`, an `.nvmrc`, and Dependabot/Renovate config so this doesn't rot again.

**Exit:** clean audit, green build/lint/test, coverage thresholds still met.

## Phase 1: Core cleanup and gap analysis against busybee-x

Compare `busybee-x/src/lib/workEvent`, `schemas.ts`, `utils`, `cli/` with `packages/core` and list
what's missing (likely: update/delete semantics, grouped events, CSV export, per-day/per-project
aggregates used by the charts).

1. New migration `002`: drop `user_id`/`channel`, add indexes (`timestamp`, `project`, `deleted`);
   keep migrations embedded (current pattern). Store `timeframe` as minutes plus original input so
   aggregation is a SQL `SUM`, not JS parsing.
2. Move aggregation (hours by project, hours per day, today total, grouped events) into core so the CLI
   `stats` command and the API share one implementation.
3. Define the **service layer** (`createEvent`, `updateEvent`, `deleteEvent`, `listEvents`,
   `listProjects`, `stats`) as the single API surface that CLI and API both call. Zod schemas live in
   core and are exported for API validation.
4. Move the DB path/config to a documented `~/.velo/` layout: `config.json`, `userDb.sqlite`,
   `run/` (pid files, logs). Add `api.port`, `api.host`, `dashboard.port` to the config schema.
5. Fill test gaps (`config.spec.ts` is 5 lines); keep the 70% threshold.

**Exit:** core exposes the full operation set with tests; CLI still works unchanged.

## Phase 2: CLI feature parity (terminal-only)

Existing: `init`, `log`, `configure`, `projects`, `stats`.

1. Add `list` (filters: project, term, date range, pagination), `edit <id>`, `rm <id>`, and
   `export` (CSV). Output as tables with `--json` for scripting.
2. Add `import`: `--csv <file>` and `--postgres <url>` (reads busybee-x `work_event`, maps `meta`/user
   fields away, dedupes by id, `--dry-run`). Pull `pg` in as an optional dependency of the CLI only for
   this command, loaded lazily so it isn't required otherwise.
3. Refactor commands to call the Phase 1 service layer; consistent error handling and exit codes
   (note `main.ts` currently `process.exit(0)`s after every command, which would kill spawned
   processes if not detached, so handle in Phase 4).
4. Command tests (inject the config and a temp DB).

**Exit:** CLI covers everything busybee-x's UI could do, plus import.

## Phase 3: `@starktech/velo-api` (Express)

1. Package scaffold; esbuild bundle to `dist/main.js`, `bin: velo-api`, core bundled in.
2. Routes, mirroring the CLI/service layer:
   - `GET /api/events` (term, project[], min_date, max_date, page, pageSize), `POST /api/events`,
     `GET|PUT|DELETE /api/events/:id`
   - `GET /api/projects`, `GET /api/stats` (by project, per day, today)
   - `GET /api/health` (returns name, version, pid, db path) used for CLI detection
   - `GET /api/export.csv`
3. Zod validation middleware, central error handler, request logging, CORS allowing only the dashboard
   origin (configured port), graceful shutdown (close DB on SIGTERM).
4. Opens the same SQLite file as the CLI. Enable WAL + `busy_timeout` in core's `initDb` so CLI writes
   and API reads/writes don't collide.
5. Tests with `supertest` against a temp DB.

**Exit:** `velo-api` starts on `127.0.0.1:<port>`, health check passes, all routes tested.

## Phase 4: Process management in the CLI

1. `velo api start|stop|status|logs` and `velo dashboard start|stop|status|logs`.
2. **Detection**: `status` hits `/api/health` (api) and fetches the dashboard root (dashboard), and
   cross-checks the pid file in `~/.velo/run/` to catch stale pids and port conflicts (something else
   on the port is reported as such, never killed).
3. **Start**: spawn the bin detached with `stdio` to a log file, write pid, wait for healthy (timeout,
   clear error). `dashboard start` first ensures the API is up and starts it if not (`--no-api` to
   skip). `velo stop` stops dashboard before api.
4. **Not installed**: if `@starktech/velo-api` / `velo-dashboard` can't be resolved, print the exact
   `npm i -g` command rather than failing obscurely.
5. `velo status` summary of both, plus `velo open` to launch the dashboard URL in the browser.
6. Tests with a fake server fixture; pid/port handling unit tested.

**Exit:** from a clean shell, `velo dashboard start` brings up both services in order and `velo status`
reports them accurately.

## Phase 5: `@starktech/velo-dashboard` (React + Vite)

Port of busybee-x UI. Same look: dark theme (`#121212` bg, `#004d61` primary), Tailwind v4, shadcn/Radix
primitives, Roboto, same layout (header icon toolbar, search/filter cards, Today card, two charts,
grouped events table, edit sheet).

1. Scaffold Vite + React 19 + TypeScript; copy `components/ui/*`, `globals.css`, `tailwind` config,
   `components.json` from busybee-x. Drop `"use client"`, `next/font` (use `@fontsource/roboto`),
   and `server-only`.
2. Port, trimming dead code: `page.tsx` becomes `App.tsx`; `today-card`, `events-table`,
   `grouped-events-table`, `edit-resource-sheet`, filters, charts (`recharts`), `export-csv`,
   `filter-storage`, `use-toast`. Remove unused shadcn components (sidebar, drawer, avatar, etc.) after
   checking usage. Replace `zod@3` usage with the repo's zod 4.
3. **Contract with the CLI (Phase 4, implemented):** the `velo-dashboard` bin accepts `--port <n>` and `--api-url <url>`, and serves `GET /config.json` returning `{ "name": "velo-dashboard", "version": "...", "pid": <process.pid>, "apiUrl": "<api-url>", "home": "<velo data dir>" }` (`--home <dir>` is passed by the CLI; a service whose `home` differs from the CLI's is treated as a port conflict, never adopted or stopped). The CLI uses that for detection and for stopping it (it signals the reported pid). It binds `127.0.0.1` only.
4. API client module; base URL from `/config.json` served alongside the bundle (so the published,
   prebuilt SPA can be pointed at any port without rebuilding), with a clear "API not reachable" state
   and retry.
5. Distribution: publish the **prebuilt** `dist/` plus a tiny static-file server bin
   (`velo-dashboard`) so users don't need Vite at runtime. `vite dev` with proxy is for development
   only.
6. Move/port the existing component specs (`events-table`, `edit-resource-sheet`) to Vitest + Testing
   Library; visual check against busybee-x side by side (screenshots at desktop and mobile widths).

**Exit:** dashboard visually matches busybee-x and does every operation through the API.

## Phase 6: Autostart on login (implemented; see `docs/development.md`)

1. `velo service install [api|dashboard|all]`, `uninstall`, `status`.
2. macOS: write `~/Library/LaunchAgents/dev.starktech.velo.{api,dashboard}.plist` (`RunAtLoad`,
   `KeepAlive`, log paths under `~/.velo/run/`), load with `launchctl bootstrap gui/$UID`. Dashboard
   unit depends on the API via a start-time health wait in the dashboard bin (launchd has no ordering).
3. Linux: `~/.config/systemd/user/velo-{api,dashboard}.service` with `After=`/`Requires=` for the
   dashboard, `systemctl --user enable --now`; note `loginctl enable-linger` if they want it at boot
   rather than login.
4. Use absolute paths of the resolved node binary and bin script (nvm/fnm paths break otherwise), and
   record them in the unit; `velo service install` re-run refreshes them after upgrades.
5. `--dry-run` prints the generated files; unit-test generators as pure functions; manual verification
   on macOS here, Linux via a container.
6. Make `velo api start` aware of managed services (don't spawn a duplicate; delegate to
   `launchctl`/`systemctl` when installed).

**Exit:** after reboot/login both come up, `velo status` shows them healthy.

## Phase 7: Publishing, CI, docs (implemented; see `docs/releasing.md` and `docs/migrating-from-busybee.md`)

1. `files`, `bin`, `exports`, `engines`, `repository`, `publishConfig.access=public` for cli/api/dashboard;
   `npm pack --dry-run` checks that bundled output has no workspace references.
2. GitHub Actions: lint, build, test (Node 22 + current), `npm audit --omit=dev`, and tag-driven publish
   with provenance. Changesets (or a single lockstep version) for releases.
3. README per package; top-level quick start: `npm i -g @starktech/velo`, optional
   `@starktech/velo-api`/`velo-dashboard`, `velo service install`. Update `CLAUDE.md` for the new
   packages/commands.
4. Retire `busybee-x` only after importing real data and confirming totals match (hours per project)
   between the old UI and the new dashboard.

---

## Risks and open items

- **Lockstep versions vs independent**: the API contract between api/dashboard/cli needs a version
  check. Plan: `/api/health` returns the API version and the dashboard warns on a major mismatch.
- **`better-sqlite3` native build** across macOS/Linux and Node versions is the most likely install
  failure for a global CLI; verify prebuilds for the Node range in `engines`.
- **No-auth API**: any local process (and any webpage via DNS rebinding or simple requests) can reach a
  loopback server. Mitigate cheaply even without auth: validate the `Host` header, restrict CORS, require
  `Content-Type: application/json` on writes. Revisit a token later if you want it.
- **Package name availability** on npm is unverified.
- Uncommitted working-tree edits (jest downgrade) are untouched until you confirm Phase 0 step 1.

## Suggested order

0 → 1 → 2 can ship as a CLI-only release. 3 → 4 add the API and management. 5 is the largest chunk and
can proceed in parallel with 4 once the API routes (Phase 3) are stable. 6 and 7 close out.

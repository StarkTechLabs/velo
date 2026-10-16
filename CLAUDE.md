# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velo is a time tracking CLI tool. It is an npm workspace monorepo with these packages:
- `packages/core` (`@starktech/core`) — business logic, database, and data layer (private; bundled into the others)
- `packages/cli` (`@starktech/velo`) — CLI application using Commander.js
- `packages/api` (`@starktech/velo-api`) — optional local Express REST API

## Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build only the CLI (esbuild)
npm run build -w @starktech/velo

# Watch CLI for changes during development
npm run watch -w @starktech/velo

# Run all tests
npm run test

# Run tests for a specific package
npm run test -w @starktech/core
npm run test -w @starktech/velo

# Run a single test file (from repo root)
npm test -w @starktech/core -- lib/common/utils.spec.ts

# Lint all packages
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

## Architecture

### Core Package (`packages/core/lib/`)

Single-user. The service layer below is the one API surface the CLI (and later the API package) calls. Core uses relative imports (no `@/` alias) so other packages can consume it.

- **`types.ts`** — Zod schemas (`createEventSchema`, `updateEventSchema`, `listEventsSchema`, `timeframeSchema`) and types (`WorkEvent`, `Stats`, `GroupedEvent`, `Page`). Timeframe format is `<number><unit>` (e.g., `30m`, `1.5h`, `2d`); `minutes` is stored on each event for SQL aggregation.
- **`common/config.ts`** — Config at `~/.velo/config.json` (override the directory with `VELO_HOME`), validated with zod and merged with defaults: `databaseFilePath`, `api: {host, port}`, `dashboard: {port}`. Also `getRunPath()` (`~/.velo/run`) for pid files/logs.
- **`common/db.ts`** — SQLite via `better-sqlite3` + `knex`, WAL + busy timeout so processes can share the file. Global singleton; call `initDb(config)` first (`closeDb()` to shut down).
- **`migrations/`** — Embedded knex migrations (no migration files on disk). Add new ones to `MIGRATIONS` + `MIGRATION_MAP`.
- **`data/workEvent.ts`** — `createEvent`, `getEvent`, `listEvents` (term/project/date filters, pagination), `updateEvent`, `deleteEvent` (soft delete), `listProjects`. Inputs are validated by the zod schemas, so callers may pass raw input.
- **`data/stats.ts`** — `getStats(filter)`: totals, by project, by local day.
- **`data/import.ts`, `import/`** — `importEvents` (bulk, idempotent by id, dry-run), `csvToEvents` (velo/busybee-x export and legacy Busywork log formats; content-derived ids), `busybeeRowToEvent`.
- **`common/group.ts`** — Pure helpers `groupEvents` and `eventsToCsv` (no node imports, safe for the browser).
- **`common/utils.ts`, `dates.ts`, `uuid.ts`, `errors.ts`** — Timeframe parsing/formatting, date helpers, UUID v7 (`crypto`-based, no dependency), `errorMessage`.
- **`testing/memoryDb.ts`** — In-memory migrated SQLite for specs.
- **`index.ts`** — Public API exports.

### CLI Package (`packages/cli/lib/`)

- **`main.ts`** — Commander.js program entry point.
- **`commands/`** — One file per command: `init`, `configure` (`--api-host/--api-port/--dashboard-port`), `log`, `list`, `edit`, `rm`, `stats`, `projects`, `export`, `import` (`csv`, `postgres`), and `services.ts`: `status`, `start`, `stop`, `open`, plus `api|dashboard start|stop|restart|status|logs`. `format.ts`/`options.ts`/`prompt.ts` hold shared output, filter flags and confirmation. Commands throw; `main.ts` prints `error: <message>` and exits 1 (`VELO_DEBUG=1` for stack traces). `rm`/`edit` accept the full id or the trailing characters shown in `velo list`.
- Tests run the real commands in-process against an in-memory DB (`lib/testing/run.ts`). `commander` is ESM-only, so `jest.config.ts` transforms it.
- `pg` is an optional dependency, loaded lazily by `import postgres` only.
- The CLI builds to `dist/main.js` via esbuild (ESM, Node 22 target, `commander` externalized).

### Managing the optional services (`packages/cli/lib/services/`)

The CLI never imports `@starktech/velo-api`/`velo-dashboard`; it finds their bins and spawns them.
- **`definitions.ts`** — per-service host/port/url/args and the identity contract: a running service answers JSON `{name, version, pid}` — the API at `GET /api/health` (`velo-api`), the dashboard at `GET /config.json` (`velo-dashboard`, which also carries its `apiUrl`). The dashboard bin must accept `--port <n> --api-url <url>`; the API bin `--host --port`.
- **`probe.ts`** — `running` (identity matches) / `down` (ECONNREFUSED) / `foreign` (something else holds the port).
- **`resolve.ts`** — locates the installed package's bin (via `node_modules` above the CLI, so global siblings and the monorepo both work), else a bin on PATH; otherwise `NotInstalledError` with the `npm install -g` hint.
- **`manage.ts`** — `startService` (detached `node <bin>`, stdout/stderr to `~/.velo/run/<name>.log`, pid file, waits for the probe to report the spawned pid, surfaces the log tail if it dies or times out), `stopService`, `getStatus`.
- **Safety rule**: `stopService` only signals the pid the service itself reports from its probe, never one read from a pid file or guessed from a port; a `foreign` port is reported and left alone. Don't weaken this.
- Pass `env: process.env` explicitly when spawning (jest gives tests a copy of `process.env`).
- Tests use `testing/fakeService.mjs` + `useFakeServices()` (real detached processes, temp `VELO_HOME`, free ports).

### API Package (`packages/api/lib/`)

- **`main.ts`** — `velo-api` bin: `--host`/`--port` override `config.api`; SIGTERM/SIGINT close the server and DB. Exits 1 with a clear message on a bad port or `EADDRINUSE`.
- **`app.ts`** — `createApp(options)` builds the Express app without listening (this is what tests drive with supertest). **`server.ts`** — `startServer(config)` inits the DB and binds.
- **Routes** (`routes/`): `GET /api/health` (name, version, pid, db path; used by the CLI to detect the API), `/api/events` (list/create) and `/api/events/:id` (get/PUT/DELETE), `/api/projects`, `/api/stats`, `/api/export.csv`. List/stats/export filters: `term`, `project` (repeatable), `min_date`, `max_date`; list also `page`, `pageSize`. Errors are `{error, issues?}` JSON (zod errors → 400).
- **No authentication by design**, so `security.ts` guards the browser attack surface: loopback-only `Host` header (anti DNS-rebinding), only the dashboard origin (plus `VELO_ALLOWED_ORIGINS`) may send an `Origin`, and writes require `Content-Type: application/json`. Keep these when adding routes.
- Express 5: `app.listen`'s callback receives bind errors, so don't ignore its argument. Handlers may be async and throw.
- Built with esbuild like the CLI; `express`, `knex`, `better-sqlite3` are external runtime dependencies, core and zod are bundled. `__VERSION__` is injected at build time.

### Key Conventions

- **TypeScript path alias**: `@/*` maps to `./lib/*` in both packages.
- **Core** compiles to CommonJS; **CLI** compiles to ESM.
- Coverage thresholds: 70% across branches, functions, lines, and statements.
- Prettier: no semicolons, double quotes, 100-char line width, trailing commas everywhere.

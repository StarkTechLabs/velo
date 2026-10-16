# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Velo is a time tracking CLI tool. It is an npm workspace monorepo with two packages:
- `packages/core` (`@starktech/core`) — business logic, database, and data layer
- `packages/cli` (`@starktech/velo`) — CLI application using Commander.js

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

Single-user. The service layer below is the one API surface the CLI (and later the API package) calls.

- **`types.ts`** — Zod schemas (`createEventSchema`, `updateEventSchema`, `listEventsSchema`, `timeframeSchema`) and types (`WorkEvent`, `Stats`, `GroupedEvent`, `Page`). Timeframe format is `<number><unit>` (e.g., `30m`, `1.5h`, `2d`); `minutes` is stored on each event for SQL aggregation.
- **`common/config.ts`** — Config at `~/.velo/config.json` (override the directory with `VELO_HOME`), validated with zod and merged with defaults: `databaseFilePath`, `api: {host, port}`, `dashboard: {port}`. Also `getRunPath()` (`~/.velo/run`) for pid files/logs.
- **`common/db.ts`** — SQLite via `better-sqlite3` + `knex`, WAL + busy timeout so processes can share the file. Global singleton; call `initDb(config)` first (`closeDb()` to shut down).
- **`migrations/`** — Embedded knex migrations (no migration files on disk). Add new ones to `MIGRATIONS` + `MIGRATION_MAP`.
- **`data/workEvent.ts`** — `createEvent`, `getEvent`, `listEvents` (term/project/date filters, pagination), `updateEvent`, `deleteEvent` (soft delete), `listProjects`. Inputs are validated by the zod schemas, so callers may pass raw input.
- **`data/stats.ts`** — `getStats(filter)`: totals, by project, by local day.
- **`common/group.ts`** — Pure helpers `groupEvents` and `eventsToCsv` (no node imports, safe for the browser).
- **`common/utils.ts`, `dates.ts`, `uuid.ts`, `errors.ts`** — Timeframe parsing/formatting, date helpers, UUID v7 (`crypto`-based, no dependency), `errorMessage`.
- **`testing/memoryDb.ts`** — In-memory migrated SQLite for specs.
- **`index.ts`** — Public API exports.

### CLI Package (`packages/cli/lib/`)

- **`main.ts`** — Commander.js program entry point.
- **`commands/`** — One file per command: `init`, `log`, `configure`.
- The CLI builds to `dist/main.js` via esbuild (ESM, Node 22 target, `commander` externalized).

### Key Conventions

- **TypeScript path alias**: `@/*` maps to `./lib/*` in both packages.
- **Core** compiles to CommonJS; **CLI** compiles to ESM.
- Coverage thresholds: 70% across branches, functions, lines, and statements.
- Prettier: no semicolons, double quotes, 100-char line width, trailing commas everywhere.

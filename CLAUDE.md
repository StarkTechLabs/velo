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
npx jest packages/core/lib/common/utils.spec.ts

# Lint all packages
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

## Architecture

### Core Package (`packages/core/lib/`)

- **`types.ts`** — Zod schemas and TypeScript types for `WorkEvent`, `User`, `Team`, `Channel`, `GroupedEvent`, and timeframes. Timeframe format is `<number><unit>` (e.g., `1h`, `30m`, `2d`, `1.5h`).
- **`common/config.ts`** — Config stored at `~/.velo/config.json`. Default DB path: `~/.velo/userDb.sqlite`. Functions: `getConfig()`, `writeConfig()`, `validateConfig()`, `ensureConfig()`.
- **`common/db.ts`** — SQLite via `better-sqlite3` + `knex`. Uses a global singleton `global.db`. Must call config init before DB access.
- **`data/workEvent.ts`** — CRUD for `work_event` table. Uses UUID v7 for IDs, soft deletes (`deleted: true`), metadata stored as JSON (channel/team/user). Supports pagination and filtering by term, project, and date range.
- **`common/utils.ts`** — Timeframe parsing and formatting utilities.
- **`index.ts`** — Public API exports for the core package.

### CLI Package (`packages/cli/lib/`)

- **`main.ts`** — Commander.js program entry point.
- **`commands/`** — One file per command: `init`, `log`, `configure`.
- The CLI builds to `dist/main.js` via esbuild (ESM, Node 22 target, `commander` externalized).

### Key Conventions

- **TypeScript path alias**: `@/*` maps to `./lib/*` in both packages.
- **Core** compiles to CommonJS; **CLI** compiles to ESM.
- Coverage thresholds: 70% across branches, functions, lines, and statements.
- Prettier: no semicolons, double quotes, 100-char line width, trailing commas everywhere.

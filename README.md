# velo

Time tracking from the terminal, with an optional local API and web dashboard. Your data is a single
SQLite file on your machine.

| Package                                           | What it is                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`@starktech/velo`](packages/cli)                 | The `velo` command: log, list, edit, stats, export, import, and management of the two below |
| [`@starktech/velo-api`](packages/api)             | Optional local REST API (Express)                                                           |
| [`@starktech/velo-dashboard`](packages/dashboard) | Optional web dashboard (React + Vite) that talks to the API                                 |

`@starktech/core` holds the shared logic and is bundled into the packages above (it isn't
published on its own).

## Install

```bash
npm install -g @starktech/velo                                   # just the CLI
npm install -g @starktech/velo @starktech/velo-api @starktech/velo-dashboard   # with the dashboard
```

Requires Node 22 or newer.

## Use

```bash
velo init
velo log acme 90m "Fix login redirect"
velo stats today
velo list
velo start && velo open        # API + dashboard (if installed)
velo service install           # start them at login (macOS and Linux)
```

See the [CLI README](packages/cli/README.md) for every command.

## Migrating from busybee-x

See [docs/migrating-from-busybee.md](docs/migrating-from-busybee.md).

## Contributing

Building from source, running the pieces locally, tests, and releasing:

- [Development guide](docs/development.md)
- [Releasing](docs/releasing.md)
- [CLAUDE.md](CLAUDE.md) (architecture and conventions)

A quick local setup (this uses a sandbox data directory, so your real `~/.velo` is never touched):

```bash
npm ci && npm run build
. scripts/dev-env.sh    # sandboxed data directory + a `velo` command for this checkout
velo start && velo open
```

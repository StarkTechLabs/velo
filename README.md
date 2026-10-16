# velo

Time tracking cli.

## CLI

### Installation

```bash
npm install -g @starktech/velo@latest
```

### Usage

```bash
velo --help
```

## Development

Building and running velo from a checkout (CLI, API, dashboard, tests, and how to avoid touching
your real data) is covered in [docs/development.md](docs/development.md). Architecture notes and
conventions are in [CLAUDE.md](CLAUDE.md).

```bash
npm ci && npm run build
. scripts/dev-env.sh    # sandboxed data directory + a `velo` command for this checkout
velo start && velo open
```

## App (coming soon)

Download the latest from releases

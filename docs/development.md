# Development guide

How to build, run, and test velo from a checkout. For architecture and code conventions see
[`CLAUDE.md`](../CLAUDE.md); for where the project is headed see [`PLAN.md`](../PLAN.md).

- [Quick start](#quick-start)
- [The sandbox (read this first)](#the-sandbox-read-this-first)
- [Packages](#packages)
- [Running things](#running-things)
  - [CLI](#cli)
  - [API](#api)
  - [Dashboard](#dashboard)
  - [Everything, the way a user runs it](#everything-the-way-a-user-runs-it)
  - [A typical development session](#a-typical-development-session)
- [Autostart (login items)](#autostart-login-items)
- [Packaging and releasing](#packaging-and-releasing)
- [Sample data](#sample-data)
- [Tests, lint, formatting](#tests-lint-formatting)
- [Ports and configuration](#ports-and-configuration)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)

## Quick start

You need **Node 22 or newer** (`nvm use` picks it up from `.nvmrc`) and npm. There is nothing else
to install: the database is SQLite through `better-sqlite3`, which ships prebuilt binaries for
current Node versions.

```bash
npm ci                      # install every workspace
npm run build               # builds api, cli and dashboard, with core bundled in (a few seconds)
. scripts/dev-env.sh        # sandbox + a `velo` command that runs this checkout
velo init
velo configure --api-port 4417 --dashboard-port 4418   # own ports, so it can't clash with a real velo
node scripts/seed-dev.mjs > /tmp/velo-seed.csv && velo import csv /tmp/velo-seed.csv
velo start                  # API on :4417, dashboard on :4418
velo open                   # or visit http://localhost:4418
```

When you are done: `velo stop`.

## The sandbox (read this first)

velo keeps its config, database, logs and pid files in **`~/.velo`**. A development build can
change that database: migrations run automatically on startup, and a newer schema can't be read
by an older build of the CLI. So while developing, never point a build from this checkout at your
real data.

`VELO_HOME` overrides the data directory. Sourcing the helper does the safe thing for you:

```bash
. scripts/dev-env.sh
# velo dev environment: VELO_HOME=/path/to/velo/.velo-dev
```

It sets `VELO_HOME` to `./.velo-dev` (git-ignored) and defines a `velo` shell function that runs
`packages/cli/dist/main.js`. It works in bash and zsh, from any directory, and prints a warning if
`VELO_HOME` is set to your real directory. **Source it in every new terminal**; without it, `velo`
means whatever you installed globally, using your real data.

**Give the sandbox its own ports** if you also run velo for real (the defaults are 4317 and
4318): `velo configure --api-port 4417 --dashboard-port 4418`. The CLI will not mix the two up
even if you forget: each service reports which data directory it belongs to, and the CLI treats
one from _another_ directory as a port conflict, never as its own. It will not report it as
running, adopt it, or stop it. (Services started by builds from before this check don't report a
directory, so restart them once, `velo stop && velo start`, after upgrading.) Still, separate
ports save you the confusing error.

Everything below assumes the sandbox is active. To start over:

```bash
velo stop
rm -rf .velo-dev
```

Inspect the sandbox database directly if you need to (the `-wal`/`-shm` files next to it are
normal while a service is running; don't copy the database file around while it is):

```bash
sqlite3 "$VELO_HOME/userDb.sqlite" ".schema work_event" "select count(*) from work_event"
```

## Packages

| Package   | Path                 | Publishes as                | What it is                                             | Run it from source                                                   |
| --------- | -------------------- | --------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| core      | `packages/core`      | (private)                   | Business logic, SQLite, config, shared types           | not run directly; bundled into the others                            |
| cli       | `packages/cli`       | `@starktech/velo`           | The `velo` command                                     | `velo …` (after sourcing the helper)                                 |
| api       | `packages/api`       | `@starktech/velo-api`       | Express REST API                                       | `node packages/api/dist/main.js` or `velo api start`                 |
| dashboard | `packages/dashboard` | `@starktech/velo-dashboard` | React + Vite single-page app and a small static server | `npm run dev -w @starktech/velo-dashboard` or `velo dashboard start` |

`api` and `dashboard` are optional extras. The CLI never imports them; it finds their built bins
and starts them as separate processes. Core is compiled into each package that uses it
(`@starktech/core` for node code, `@starktech/core/browser` for the dashboard), so **changing core
means rebuilding the packages that use it**; the watch modes below do that for you.

## Running things

All build output goes to each package's `dist/` (git-ignored). `npm run build` at the root builds
everything; add `-w <package>` to build one.

### CLI

```bash
npm run build -w @starktech/velo    # one-off
npm run watch -w @starktech/velo    # rebuild on every change (keep it running in a terminal)
velo --help
```

The `velo` function runs the built file, so after a change either run the build once or keep the
watcher going. Core is part of the CLI bundle, so edits under `packages/core/lib` trigger the
watcher too.

### API

```bash
npm run build -w @starktech/velo-api
node packages/api/dist/main.js --port 4317      # --host and --port override the config
```

For an edit, rebuild, restart loop, run these in two terminals:

```bash
npm run watch -w @starktech/velo-api            # terminal 1: rebuild on change
node --watch packages/api/dist/main.js          # terminal 2: restart when the bundle changes
```

Poke at it with curl (use your sandbox port, 4417, if you configured one; the examples show the default. The API only accepts loopback `Host` headers and, for browser-style
requests, only the dashboard's origin; plain curl is fine):

```bash
curl -s localhost:4317/api/health          # also shows the database file and data directory it serves
curl -s 'localhost:4317/api/events?project=velo&min_date=2026-01-01&pageSize=5'
curl -s -X POST localhost:4317/api/events \
  -H 'Content-Type: application/json' \
  -d '{"project":"velo","timeframe":"1h","description":"from curl"}'
curl -s localhost:4317/api/stats
curl -s localhost:4317/api/export.csv
```

Writes must send `Content-Type: application/json`. Requests carrying an `Origin` header are
refused unless it is the dashboard's, so a `403` from a script usually means it is sending one.

### Dashboard

Development uses the Vite dev server with hot reload. It needs the API running:

```bash
velo api start                                    # or node packages/api/dist/main.js
npm run dev -w @starktech/velo-dashboard          # http://localhost:5173
```

Vite answers `/config.json` itself (with an empty `apiUrl`, meaning "same origin") and proxies
`/api` to the real API, so the browser never makes a cross-origin request. The proxy also drops
the `Origin` header, because the API only accepts browser origins from the dashboard's configured
port. To point at an API somewhere else:

```bash
VELO_API_URL=http://127.0.0.1:4511 npm run dev -w @starktech/velo-dashboard
```

Edits to the dashboard, and to anything it imports from `@starktech/core/browser`, hot reload.

To see exactly what users get (the built app served by the small static server on `:4318`):

```bash
npm run build -w @starktech/velo-dashboard      # vite build, then bundles the server
velo dashboard start                            # starts the API first if needed
```

Rebuild and `velo dashboard restart` to pick up changes; the Vite dev server is much faster for
day-to-day UI work.

> **UI work has a high bar.** The dashboard is a port of the busybee-x UI and is expected to look
> the same. Its CSS is copied from the original on purpose and relies on some Tailwind/shadcn
> tokens being _undefined_; see the "Dashboard Package" notes in `CLAUDE.md` before changing
> styles or adding a theme plugin.

### Everything, the way a user runs it

`velo start` is the path real users take. It resolves each service's package (through
`node_modules`, so in this repo that is the workspace), runs it detached, and waits until it
reports healthy.

```bash
velo start               # api, then dashboard
velo status              # running / stopped / conflict / not installed, with pids
velo api logs -f         # follow a service's log (also: velo dashboard logs)
velo api restart         # after rebuilding
velo stop                # dashboard first, then api
```

Logs and pid files are in `$VELO_HOME/run/` (`api.log`, `api.pid`, `dashboard.log`,
`dashboard.pid`). If `velo start` says a service "is not installed" it usually means its `dist/`
doesn't exist yet: run `npm run build`.

### A typical development session

Four terminals, each with `. scripts/dev-env.sh`:

1. `npm run watch -w @starktech/velo-api` and then, in the same terminal or a second one,
   `node --watch packages/api/dist/main.js`
2. `npm run dev -w @starktech/velo-dashboard`
3. `npm run watch -w @starktech/velo` (only when changing the CLI or core)
4. Your working terminal for `velo …`, `curl`, and tests

If you are only touching core or the CLI, you don't need the API or dashboard at all; run
`npm test -w @starktech/core` and use `velo` directly.

## Autostart (login items)

`velo service install` makes the API and dashboard start when you log in: a launchd LaunchAgent
on macOS, a systemd user unit on Linux. Users run it once; for development you mostly need to
know how it behaves and how to test it without disturbing your own setup.

```bash
velo service install [api|dashboard|all]    # writes the unit, activates it, starts the service now
velo service install --dry-run               # print the files and commands; change nothing
velo service status                          # per service: enabled / stale / not installed, and running now
velo service uninstall [api|dashboard|all]   # deactivates (which stops the service) and deletes the unit
```

How it works, in the places you'll look:

|                | macOS (launchd)                                                                                                 | Linux (systemd)                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Unit file      | `~/Library/LaunchAgents/dev.starktech.velo.<service>.plist`                                                     | `~/.config/systemd/user/velo-<service>.service` (honours `XDG_CONFIG_HOME`) |
| Activated with | `launchctl bootstrap gui/$UID <plist>` (after a `bootout`)                                                      | `systemctl --user enable --now` (then `restart`)                            |
| Runs           | `$VELO_HOME/launchers/velo-<service>`, a small script that `exec`s node (so the login item is named `velo-api`) | `node <script>` directly                                                    |
| Restart policy | `KeepAlive {SuccessfulExit: false}`                                                                             | `Restart=on-failure`                                                        |
| Logs           | `$VELO_HOME/run/<service>.log` (same file `velo <service> logs` reads)                                          | same                                                                        |

- **The login item is named after a launcher, not node.** macOS lists a login item (System Settings →
  General → Login Items & Extensions) under the name of the _signer_ of the program launchd runs, and
  the `node` binary is signed by the Node.js Foundation, so running it directly shows up as
  "Node.js Foundation". Each agent therefore runs `~/.velo/launchers/velo-api` /
  `velo-dashboard`, an unsigned `#!/bin/sh` script that immediately `exec`s node (same pid, so
  launchd's tracking, `KeepAlive` and `velo status` are unaffected), and macOS shows the script's
  name. The script is rewritten on every `velo service install`, is part of the `stale` check, and is
  removed by `uninstall`. This was chosen by experiment: a script showed its own name, a script
  associated with a stub `.app` via `AssociatedBundleIdentifiers` also worked but needs an app
  bundle, and a signed copy of node was not worth shipping. (Process listings still show `node`;
  only the Login Items entry is renamed.) Linux is unaffected: systemd shows the unit name.
- **A crash restarts it; a clean stop does not.** `velo api stop` sends SIGTERM, the process exits
  0, and the service manager leaves it stopped until the next login or `velo api start`. Once a
  unit is installed, `velo api start` asks launchd/systemd to start it instead of spawning a second,
  unmanaged copy (the output says `by launchd` / `by systemd`).
- **Units are named for the data directory.** The real `~/.velo` gets the plain names above. Any
  other `VELO_HOME` (your sandbox) gets a short hash in the name (`dev.starktech.velo.edb549e1.api`,
  `velo-edb549e1-api.service`), so installing from the sandbox can never replace or remove your real
  login items, and `uninstall` only ever touches the current data directory's units.
- **The dashboard waits for the API.** Its unit passes `--wait-for-api 60`: it polls
  `/api/health` for up to a minute at login, then starts anyway (the page shows a banner if the API
  is still down). systemd also orders it `After=`/`Wants=` the API unit; launchd has no ordering.
- **What goes stale.** The API reads its host and port from `config.json` on every start, so its
  unit never goes stale. The dashboard doesn't read config, so its ports are written into its unit;
  after `velo configure --dashboard-port …` (or a different Node, or a moved install) run
  `velo service install` again. `velo service status` shows `stale` when the file on disk no longer
  matches what would be written now.
- **Absolute paths.** The unit records the node binary that ran `velo service install` and the
  resolved script of each service, because nothing at login has your shell's `PATH`. If you switch
  Node versions with nvm, reinstall.
- **Linux boot vs login.** User units start at _login_. To start them at boot run
  `sudo loginctl enable-linger $USER` once.

### Testing autostart safely

The automated tests never touch your real login items. Every CLI test file starts with a throwaway
`VELO_HOME`, a fake home directory, and a service-manager runner that **throws** if anything tries to
run the real `launchctl`/`systemctl` (`packages/cli/lib/testing/setup.ts`). Tests that need a manager
use a fake that parses the generated plist or unit and spawns _exactly_ the command line it
specifies (`useFakeServiceManager` in `lib/testing/autostart.ts`), so the real generated arguments
are exercised. Keep it that way: a test that times out is torn down while its async work is still
running, and that work will happily write to whatever the environment looks like afterwards.

What the fakes can't tell you, check with the real tools (these install nothing):

```bash
velo service install --dry-run     # read the plist / unit and the commands it would run
plutil -lint file.plist            # macOS: validate a generated plist
systemd-analyze verify velo-api.service velo-dashboard.service   # Linux: units in /etc/systemd/system
```

Real launchd behaves differently from any fake in ways that matter (for example `bootout` returns
before the job is actually unloaded), so after changing `autostart/manager.ts` do a real install from
the sandbox, as below, and exercise the unhappy paths: `kill -9` the service (launchd should restart
it), `velo api stop` (it should stay stopped), and change a port then reinstall.

To try a real install end to end from the sandbox (it uses hashed labels, so it can't touch a real
setup), then remove it:

```bash
. scripts/dev-env.sh
velo service install        # services start now, and at every login from now on
velo service status
velo service uninstall      # always clean up after yourself
```

On macOS, `launchctl list | grep dev.starktech.velo` shows what is loaded. On Linux,
`systemctl --user status 'velo-*'` and `journalctl --user -u 'velo-*'`.

## Sample data

An empty dashboard isn't much to look at. Generate three weeks of plausible events and import
them:

```bash
node scripts/seed-dev.mjs > /tmp/velo-seed.csv          # optional argument: number of days (default 21)
velo import csv /tmp/velo-seed.csv                      # --dry-run to preview
```

The ids are derived from the row contents, so importing the same file twice does nothing the
second time. Other ways to get data in:

```bash
velo log velo 90m "wrote the dev guide"                 # one event, now
velo log velo 1h "yesterday" --timestamp 2026-10-15T14:00:00Z
velo import postgres postgres://user:pass@host:5432/busybee --user-id <id> --dry-run
```

`velo import csv` also reads CSV exported by `velo export` and by the old busybee-x UI. Note the
CSV format is lossy (events are grouped per day, project and description, and placed at noon);
the Postgres import keeps exact timestamps.

## Packaging and releasing

The three published packages are checked the way a user receives them:

```bash
scripts/smoke-pack.sh                  # build, pack, install the tarballs into an empty prefix, drive the installed commands
SKIP_BUILD=1 scripts/smoke-pack.sh     # reuse the existing dist/ folders
npm pack --dry-run -w @starktech/velo  # list what would be published
```

It needs network access (npm installs the packages' dependencies) and uses a temp data directory and
free ports; it never touches your `~/.velo` or default ports. Run it after changing a `package.json`,
the `files` list, an esbuild config, or adding an import that stays external in a bundle (that
becomes a runtime dependency). Version numbers and the release procedure are in
[releasing.md](releasing.md); `npm run version:set -- X.Y.Z` keeps the packages in step.

## Tests, lint, formatting

```bash
npm test                  # every package (jest for core/cli/api, vitest for the dashboard)
npm run lint              # eslint + prettier across the workspace
npm run lint:fix          # auto-fix what it can
```

Per package, and for a single file or test:

```bash
npm test -w @starktech/core
npm test -w @starktech/core -- lib/data/workEvent.spec.ts        # one file
npm test -w @starktech/core -- -t "resolveEventId"                # by test name
npm test -w @starktech/core -- --coverage                         # core must stay at 70%+
npm test -w @starktech/core -- --watch

npm test -w @starktech/velo                                       # cli
npm test -w @starktech/velo -- lib/services

npm test -w @starktech/velo-api

npm test -w @starktech/velo-dashboard                             # vitest, runs once
npm test -w @starktech/velo-dashboard -- src/lib/api.spec.ts
npm exec -w @starktech/velo-dashboard -- vitest                   # watch mode
```

Prettier settings (no semicolons, double quotes, 100 columns) are enforced through eslint, so
`npm run lint:fix` also formats. Type-check a package with `npx tsc -p packages/<name> --noEmit`
(for the dashboard: `cd packages/dashboard && npx tsc --noEmit`).

What the tests do, so nothing surprises you:

- **They never touch `~/.velo`.** Core and API tests use in-memory SQLite or temp directories;
  config tests set `VELO_HOME` to a temp directory.
- **CLI tests run commands in-process** (`lib/testing/run.ts`) against an in-memory database.
- **The service-management tests start real processes.** They launch
  `lib/testing/fakeService.mjs` (a stand-in for the api and dashboard) detached, on free ports,
  with a temp `VELO_HOME`, and kill them afterwards. If a run is interrupted you can find
  leftovers with `pgrep -fl fakeService.mjs`.
- **The API tests** drive the Express app with supertest, and one spec starts the real server on
  an ephemeral port.
- **The dashboard tests** run in jsdom (components and the API client) or node (the static
  server). See `src/test-setup.ts` for the browser APIs that jsdom lacks.
- Jest is configured with `watchman: false` on purpose; watchman can hang runs on some
  machines.

Adding a database migration: append it to `MIGRATIONS` and `MIGRATION_MAP` in
`packages/core/lib/migrations/index.ts`, and add a case to `migrations/index.spec.ts` that
upgrades a database holding old data. To try it on realistic data, copy a database into the
sandbox rather than pointing at the real one:

```bash
cp ~/.velo/userDb.sqlite "$VELO_HOME/userDb.sqlite"
velo list            # runs the migration on the copy
```

## Ports and configuration

| What                 | Default                          | Change it                                                                           |
| -------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| API                  | `127.0.0.1:4317` (sandbox: 4417) | `velo configure --api-port 4400` / `--api-host`, or `--port`/`--host` on `velo-api` |
| Dashboard (built)    | `127.0.0.1:4318` (sandbox: 4418) | `velo configure --dashboard-port 4500`                                              |
| Dashboard (Vite dev) | `localhost:5173`                 | `npm run dev -w @starktech/velo-dashboard -- --port 5200`                           |

`velo configure --list` prints the current configuration, which lives in
`$VELO_HOME/config.json`. Restart services after changing it (`velo stop && velo start`).
Changing the dashboard port changes the origin the API trusts, so restart the API too.

If you must let the API accept another browser origin (for example a Vite dev server calling it
directly instead of through the proxy):

```bash
VELO_ALLOWED_ORIGINS=http://localhost:5173 node packages/api/dist/main.js
```

## Debugging

- **Stack traces.** The CLI, API and dashboard print one-line errors by default; set
  `VELO_DEBUG=1` to get the full error.
- **Service logs.** `velo api logs -n 100` or `-f`; the files are in `$VELO_HOME/run/`. When
  running `node packages/api/dist/main.js` yourself, requests are logged to the terminal.
- **What does the CLI think is running?** `velo status --json`. A service counts as running only
  if it answers its health endpoint with its own name (`GET /api/health` for the API,
  `GET /config.json` for the dashboard). Something else on the port shows as `conflict`.
- **Source maps** are emitted for the CLI, API and dashboard server bundles; use
  `node --enable-source-maps packages/api/dist/main.js` for readable stack traces from the
  bundle.
- **Browser.** In the dashboard, API errors surface as toasts, and an unreachable API shows a
  banner with the start command. The network tab shows the `/api/*` calls (through the Vite
  proxy in development).

## Troubleshooting

| Symptom                                                                               | Likely cause and fix                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `velo: the CLI isn't built yet`                                                       | Run `npm run build`.                                                                                                                                                                                          |
| `The API is not installed (… has it been built?)`                                     | `packages/api/dist` is missing: `npm run build -w @starktech/velo-api`. (Ignore the `npm install -g` hint; that is for end users.)                                                                            |
| status says `conflict … for a different data directory`                               | A velo service from another data directory (usually your real `~/.velo`) holds the port. That is the safety check working: give this one its own ports with `velo configure --api-port … --dashboard-port …`. |
| `port 4317 is already in use` / status says `conflict`                                | Another program (or a stale dev process) holds the port. Find it with `lsof -iTCP:4317 -sTCP:LISTEN`, or pick another port with `velo configure --api-port …`. velo never kills a process it didn't start.    |
| `The API exited during startup`                                                       | The error from the service's log is printed under it; the same text is in `velo api logs`.                                                                                                                    |
| Dashboard in dev shows "Can't reach the velo API"                                     | The API isn't running, or `VELO_API_URL` points elsewhere. `velo api start`, then Retry.                                                                                                                      |
| `403 Forbidden origin` / `Forbidden host` from the API                                | A browser-style request from an origin that isn't the dashboard's, or a non-loopback `Host` header. Use the Vite proxy, or see `VELO_ALLOWED_ORIGINS` above.                                                  |
| An error loading `better-sqlite3` (mentions a bindings file or `NODE_MODULE_VERSION`) | The native module was built for a different Node version. Run `npm rebuild better-sqlite3` (or `npm ci`) after switching Node versions.                                                                       |
| Tests hang or are very slow to start                                                  | Make sure you're using the repo's jest configs (`watchman: false`); run per package with `npm test -w …`, not bare `jest` at the root.                                                                        |
| Stale `velo` behaviour after pulling                                                  | Rebuild: `npm run build`. The `velo` helper runs `dist/`, not the sources.                                                                                                                                    |
| `velo service status` says `stale`                                                    | The unit on disk differs from what would be written now (ports changed, different Node, moved install). `velo service install` rewrites it.                                                                   |
| `launchctl bootstrap failed … Input/output error`                                     | Usually a stale or broken agent. `velo service uninstall`, then install again. Not possible over ssh without a GUI login session.                                                                             |
| `no systemd user session`                                                             | You're in a shell with no user bus (ssh without lingering, a container). Log in normally or `loginctl enable-linger $USER`; otherwise use `velo start`.                                                       |
| Autostart installed but "not answering yet"                                           | Read its log: `velo api logs`. A port held by something else makes launchd/systemd retry in a loop; free the port or `velo configure` another.                                                                |
| Want a clean slate                                                                    | `velo stop; rm -rf .velo-dev`. For build output too: `rm -rf packages/*/dist`.                                                                                                                                |

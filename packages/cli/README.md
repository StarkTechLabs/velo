# @starktech/velo

Time tracking from the terminal. Log what you worked on, see where the day went, and (optionally)
run a local API and a web dashboard. Everything is stored in a SQLite file on your machine.

```bash
npm install -g @starktech/velo
```

Requires Node 22 or newer.

## Quick start

```bash
velo init                                   # creates ~/.velo
velo log acme 90m "Fix login redirect"      # project, time spent, what you did
velo log acme 30m "Review PR #214" --timestamp 2026-10-15T14:00:00Z
velo stats today                            # today's total, per project, last event
velo list                                   # newest first; velo list -p acme --from 2026-10-01
```

Time is written as a number and a unit: `15m`, `1.5h`, `2d` (a day counts as 24 hours).

## Commands

| Command                                   | What it does                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `velo log <project> <time> <description>` | Record an event (`--timestamp` to back-date it, `--json`)                                                              |
| `velo list` (`ls`)                        | List events: `-p/--project` (repeatable), `-s/--search`, `--from`, `--to`, `--today`, `-n/--limit`, `--page`, `--json` |
| `velo edit <id>` / `velo rm <id>`         | Change or delete an event. `<id>` is the full id or the short ID column of `velo list`                                 |
| `velo stats today`                        | Totals for today                                                                                                       |
| `velo stats summary`                      | Totals for any period, overall and by project; same filters as `list` (`-p`, `--from`, `--to`, `-s`, `--json`)         |
| `velo projects`                           | Projects you have logged time against                                                                                  |
| `velo export`                             | CSV (grouped by day, project and description) or `-f json`, to stdout or `-o file`; takes the same filters as `list`   |
| `velo import csv <file>`                  | Import a CSV from `velo export`, the old busybee-x export, or the Busywork Slack log (`--dry-run`)                     |
| `velo import postgres [url]`              | Import from a busybee-x Postgres database (`--user-id`, `--dry-run`)                                                   |
| `velo configure`                          | Show or change settings: `--api-host`, `--api-port`, `--dashboard-port`                                                |

Run `velo <command> --help` for details. Anything that prints a list takes `--json`.

## The optional API and dashboard

These are separate packages; velo works without them.

```bash
npm install -g @starktech/velo-api @starktech/velo-dashboard

velo start          # API on http://127.0.0.1:4317, dashboard on http://localhost:4318
velo open           # open the dashboard (starts it, and the API, if needed)
velo status         # what is running, with pids
velo api logs -f    # also: velo dashboard logs
velo stop
```

`velo api start|stop|restart|status|logs` and `velo dashboard …` manage each one on its own. The
dashboard needs the API, so starting it starts the API first.

### Start at login (macOS and Linux)

```bash
velo service install     # API + dashboard start whenever you log in; they start now too
velo service status      # enabled / stale / not installed, and running now
velo service uninstall
```

This uses a launchd LaunchAgent on macOS and systemd user units on Linux. After changing ports with
`velo configure`, run `velo service install` again so the login units match. On Linux, units start
at login; run `sudo loginctl enable-linger $USER` once to start them at boot instead.

## Where things live

|                       |                                                 |
| --------------------- | ----------------------------------------------- |
| Data directory        | `~/.velo` (override with `VELO_HOME`)           |
| Database              | `~/.velo/userDb.sqlite`                         |
| Config                | `~/.velo/config.json` (`velo configure --list`) |
| Service logs and pids | `~/.velo/run/`                                  |

Set `VELO_HOME` to keep separate sets of data, for example to try things out without touching your
real log. Each data directory has its own services and its own login units.

If something fails, the CLI prints a one-line error; set `VELO_DEBUG=1` for the full stack trace.

## License

MIT

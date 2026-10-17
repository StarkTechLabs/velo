# @starktech/velo-dashboard

A web dashboard for [velo](https://www.npmjs.com/package/@starktech/velo), the time tracker:
hours by project and by day, today's summary, filters and search, grouped or list view, add, edit
and delete events, and CSV export. It runs on its own and talks to the velo API.

```bash
npm install -g @starktech/velo @starktech/velo-api @starktech/velo-dashboard
velo open          # starts the API and the dashboard, then opens http://localhost:4318
```

The dashboard needs [`@starktech/velo-api`](https://www.npmjs.com/package/@starktech/velo-api). If
the API isn't reachable the page says so, with the command to start it and a Retry button.

## Running it yourself

`velo dashboard start` is the usual way. The server can also be run directly:

```bash
velo-dashboard --port 4318 --api-url http://127.0.0.1:4317
```

| Option                     |                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--port <n>`               | Port to serve on (default 4318). Always binds `127.0.0.1`.                                                                  |
| `--api-url <url>`          | Where the API is (default `http://127.0.0.1:4317`). Handed to the page through `/config.json`.                              |
| `--wait-for-api <seconds>` | Wait for the API to answer before starting (used by login autostart); starts anyway after the timeout.                      |
| `--home <dir>`             | The velo data directory this belongs to (the CLI passes it so services from different data directories are never confused). |

`GET /config.json` returns `{name, version, pid, apiUrl, home}`; the `velo` command uses it to
detect and stop the dashboard.

To start it at login: `velo service install`.

## License

MIT

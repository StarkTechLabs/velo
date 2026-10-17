# @starktech/velo-api

A small local REST API for [velo](https://www.npmjs.com/package/@starktech/velo), the time tracker.
It is optional: the `velo` command works without it, and the
[dashboard](https://www.npmjs.com/package/@starktech/velo-dashboard) uses it.

```bash
npm install -g @starktech/velo @starktech/velo-api
velo api start            # or: velo-api
```

It listens on `http://127.0.0.1:4317` by default (`velo configure --api-port …`, or
`velo-api --host … --port …`) and shares the same SQLite database as the CLI, so events logged
either way show up in both.

## Endpoints

|                          |                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`        | Name, version, pid, data directory and database file. `velo status` uses this.                                                         |
| `GET /api/events`        | List, newest first. Query: `term`, `project` (repeatable), `min_date`, `max_date` (`YYYY-MM-DD` or ISO), `page`, `pageSize` (max 1000) |
| `POST /api/events`       | Create: `{"project","timeframe","description","timestamp"?}` → `201`                                                                   |
| `GET /api/events/:id`    | One event                                                                                                                              |
| `PUT /api/events/:id`    | Change any of `project`, `timeframe`, `description`, `timestamp`                                                                       |
| `DELETE /api/events/:id` | Delete → `204`                                                                                                                         |
| `GET /api/projects`      | Project names                                                                                                                          |
| `GET /api/stats`         | Totals, per project, per day (same filters as the list)                                                                                |
| `GET /api/export.csv`    | Download CSV (same filters)                                                                                                            |

Timeframes look like `30m`, `1.5h`, `2d`. Errors are JSON, `{"error": "…"}`, with a per-field
`issues` list for validation failures.

```bash
curl -s localhost:4317/api/events -H 'Content-Type: application/json' \
  -d '{"project":"acme","timeframe":"1h","description":"from curl"}'
curl -s 'localhost:4317/api/stats?project=acme&min_date=2026-10-01'
```

## Security

There is **no authentication**. The API is meant for your own machine, so it:

- binds to `127.0.0.1` only (it warns loudly if you bind elsewhere);
- rejects requests whose `Host` header isn't a loopback name (DNS-rebinding protection);
- refuses any browser request whose `Origin` isn't the dashboard's, even simple cross-site form
  posts (set `VELO_ALLOWED_ORIGINS=http://host:port,…` to allow another origin);
- requires `Content-Type: application/json` on writes.

Don't expose it to a network you don't trust.

## License

MIT

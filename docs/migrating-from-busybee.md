# Migrating from busybee-x

velo is the successor to busybee-x (the Next.js + Postgres app, also called chrono). This moves your
events across and shows how to check that nothing went missing before you switch off the old app.

What carries over: every event (project, description, time, timestamp), with its original id.
What doesn't: user, team and channel fields, the Slack integration and the Docker/Lambda setup.
velo is single-user and runs locally.

## 1. Install velo

```bash
npm install -g @starktech/velo @starktech/velo-api @starktech/velo-dashboard
velo init
```

## 2. Try it on a copy first

`VELO_HOME` points velo at a different data directory, so you can rehearse without touching your
real one:

```bash
export VELO_HOME=/tmp/velo-trial
velo init
```

(Unset it, or open a new terminal, when you're ready to do it for real.)

## 3. Import from Postgres

You need the connection URL of the busybee-x database, and the `user_id` your events were logged
under (busybee-x filtered everything to one user id, `stark` by default; a database can hold several
people's events). `pg` is installed with the CLI as an optional dependency.

```bash
velo import postgres "postgres://USER:PASSWORD@HOST:5432/busybee" --user-id stark --dry-run
velo import postgres "postgres://USER:PASSWORD@HOST:5432/busybee" --user-id stark
```

Or set `DATABASE_URL` and leave the URL out. Leave `--user-id` off to import every user's events.

- Deleted events are skipped (busybee-x soft-deletes; a `NULL` in its `deleted` column counts as not
  deleted, as it does in the old app).
- Events keep their ids, so **importing again is safe**: already-imported events are counted as
  "already present" and skipped. Use that to pick up events logged in busybee-x after your first
  import.
- A row that can't be read (for example a missing timeframe) is reported with its id and skipped; the
  rest still import.

## 4. Check the totals

Per-project hours should agree to the hundredth. In busybee-x's Postgres:

```sql
select project,
       round(sum((timeframe->>'durationInMinutes')::numeric) / 60, 2) as hours,
       count(*) as events
from work_event
where deleted is not true and user_id = 'stark'
group by project
order by hours desc;
```

And in velo:

```bash
velo stats summary
```

```
Total  4.75h  (4 events over 3 days)

PROJECT        HOURS  EVENTS
─────────────  ─────  ──────
busybee        2.25   2
client-portal  2.00   1
infra          0.50   1
```

`velo stats summary` takes the same filters as `velo list` (`-p`, `--from`, `--to`, `--today`,
`-s`), so you can compare a single week or project too. For a visual check, start the dashboard
(`velo open`) and compare it with the old app on the same date range: the layout is the same.

If a total is off, `velo list -p <project>` and the busybee-x table show the individual events.

## 5. Do it for real

Without `VELO_HOME` set, run the import again (step 3). Your data is in `~/.velo/userDb.sqlite`; copy
that file to back it up (stop the services first, `velo stop`, so the copy is consistent).

To start velo at login: `velo service install`.

## Alternative: CSV

If you can't reach the database, the busybee-x web UI's **Export to CSV** works, and so does the old
Busywork Slack log export:

```bash
velo import csv export.csv --dry-run
velo import csv export.csv
```

The UI's CSV is grouped by day, project and description and has no time of day, so each row is
imported as one event at noon on that day. Totals still match; individual times don't. Prefer the
Postgres import when you can.

## Differences you will notice

- **Time zones**: days are the days in your computer's time zone (busybee-x used the browser's).
- **Pay periods**: the dashboard's "current/last pay period" filters are the same two-week periods as
  before, counted from 2025-08-02.
- **Search, filters, grouped/list views, charts, add/edit/delete, CSV export** are all there, plus
  the `velo` command for logging without a browser.
- **No login or multi-user**: the API listens on `127.0.0.1` only and has no authentication.

## Once you're satisfied

Keep the busybee-x database until you've been using velo for a bit. Then you can stop its
containers; nothing in velo depends on them.

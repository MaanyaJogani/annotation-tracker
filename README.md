# Annotation Task & Payout Tracker

Personal annotation task tracking, session timers, project rates, review statuses,
and USD/INR payout summaries. Built with Next.js, Drizzle, and PostgreSQL.

## Run alongside other projects

Requires Node.js 22+ and installed PostgreSQL tools (`initdb`, `pg_ctl`, `pg_dump`).
On Linux, the launcher finds the installed tools under `/usr/lib/postgresql`.
Set `PG_BIN` to your PostgreSQL bin directory on other systems.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3100. The launcher creates and starts a private PostgreSQL
instance on **127.0.0.1:55432**, creates the database, and applies migrations.
It uses new, generated credentials; it does not require sudo or use the system
database service. Existing projects on UI port 3000 and DB port 5432 can keep running.

The local launcher supplies its own `DATABASE_URL`, overriding the old value in
`.env` for its child processes. Use the npm commands below for this local database.
Running Drizzle directly with a separately configured `DATABASE_URL` can target
a different database.

To use a different UI port: `ANNOTATION_UI_PORT=3200 npm run dev`.
The private database port is saved in `.local/database.json`; to change it,
stop the database, update that file and the `port` entry in
`.local/postgres/postgresql.auto.conf`, then restart.

## Install as a Linux desktop app

On a Linux desktop with a systemd user session, install Node.js 22+, PostgreSQL
server tools, Bash and curl. Brave, Google Chrome or Chromium can open the tracker
in its own window. With another default browser, the launcher uses `xdg-open`.

Clone this repository into the directory where you want to keep the app and its
data. If you already use the tracker, run these commands in your existing checkout.

```bash
npm install
node scripts/linux/install.mjs
```

Open **Annotation Tracker** from the applications menu. The launcher starts the
local server and database on demand. First launch can take a minute. The install
command registers the menu entry, icon and user service for your account without
sudo. Run it again if you move the checkout or change your Node.js installation.
If PostgreSQL needs a custom bin directory, set `PG_BIN` when running the installer.

The repository includes the launcher and installer. Your tasks, payouts, settings,
database credentials and desktop browser profile stay on your machine. A separate
clone on another computer starts with an empty tracker unless you restore a backup.

If the app fails to open, inspect the service log with
`journalctl --user -u annotation-tracker.service -n 60`.

## Data and backups

Data persists in `.local/postgres/` across server restarts and UI/code changes.
Credentials are in `.local/database.json`. Both `.local/` and `backups/` are ignored
by Git. **Do not delete `.local/` when cleaning the project.** This is a new,
empty database with default statuses, not an import of any existing sheet or app.

```bash
npm run db:backup    # timestamped PostgreSQL dump in backups/
npm run db:start     # start just the private database
npm run db:migrate   # apply migrations to the private database
npm run db:stop      # stop it without deleting data
```

Stopping Next.js leaves PostgreSQL running; `npm run db:stop` stops it explicitly.
Backups are manual. Copy dumps to another device or storage account regularly:
a backup on the same disk does not protect against losing that disk.

To restore, use `pg_restore` with a dump, the credentials from
`.local/database.json`, and **a separate empty database**. Inspect the restored
data before switching the app to it. Do not restore over your working database
without first backing it up.

For production mode, run `npm run build` followed by `npm start`.
Schema details and migration workflow are in [database/README.md](database/README.md).

## Active Focus

Only one visible task can be In Progress. That task loads automatically in Active
Focus; completed and paid tasks are never selected as a fallback. The first timer
start records the start date. Pause banks elapsed time (including partial minutes),
and Resume continues from the saved amount. Custom Add/Deduct adjusts the total
without allowing it to go below zero.
Reset asks for confirmation, clears all elapsed time, pauses the timer, and saves
the reset immediately. Task details and the original start date are preserved.

Save Progress stores the form and elapsed time together; a running timer keeps
running. Pause before closing for a break. If left running, it continues counting
wall-clock time while the app is closed. Complete Task & Send to Review saves the
form, stops timing, records the end date, and moves the task to Completed with
pending approval. Annotation and review workbench fields are supported.

`npm run test:focus` tests timer persistence and concurrency in a disposable database
on the private local PostgreSQL cluster. It does not use the annotation database.

## Approval and payout calculations

Pending Review tasks show the minimum–maximum estimate. Accepted tasks use the
maximum hourly rate; Rejected tasks use the minimum hourly rate. The board's
estimated total combines those reviewed amounts with ranges for pending work.
“Calculated by Status” includes only Accepted and Rejected tasks, regardless of
whether they are Completed or Paid & Closed. Revoked tasks are excluded from
board payout totals. Received payouts still come only from the payout ledger.

Run `node scripts/test-payout.cjs` to check the review rules, demo totals,
partial-minute calculations, and revoked-task exclusion without changing data.

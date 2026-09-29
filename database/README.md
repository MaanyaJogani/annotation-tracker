# Database

Everything database-related lives here: schema, client, and versioned migrations.

```
database/
├── schema.ts                  # Drizzle schema (source of truth for tables)
├── client.ts                  # Pooled DB client used by the app
└── migrations/                # Versioned SQL migrations (generated + custom)
    ├── 0000_init.sql          # Tables, enums, identity columns
    ├── 0001_seed_initial_data.sql
    └── meta/                  # Drizzle journal + snapshots (do not edit)
```

## Setup from scratch (fresh machine / fresh DB)

1. Install PostgreSQL and start it.
2. Create a role and database (or reuse an existing role):

   ```bash
   sudo -u postgres psql -c "CREATE ROLE <you> LOGIN SUPERUSER PASSWORD '<password>';"
   sudo -u postgres createdb -O <you> annotation_tracker
   ```

3. Copy `.env.example` from this folder to the project root as `.env` and fill in your `DATABASE_URL`.
4. Apply all migrations (creates every table + seed data):

   ```bash
   npx drizzle-kit migrate
   ```

## Workflow for changes

- **Schema change**: edit `schema.ts` → `npx drizzle-kit generate --name <change>` → review the generated SQL in `migrations/` → `npx drizzle-kit migrate`.
- **Data seed / backfill**: `npx drizzle-kit generate --custom --name <what>` → write SQL into the generated file → `npx drizzle-kit migrate`.
- Every change is a numbered, committed SQL file — anyone can clone the repo, set `DATABASE_URL`, run `npx drizzle-kit migrate`, and land on the latest database state.

## Notes

- `settings` is a singleton row (id = 1) holding worker email + cached USD→INR rate.
- `tasks.task_number` and `weekly_payouts.week_number` are identity columns (auto-increment).
- Statuses are data, not code — add/delete rows in `statuses` to change the task status list.

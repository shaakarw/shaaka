# Turso persistence

The backend uses `@libsql/client` and requires `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` in `backend/.env`. They are backend-only settings; do not
copy them into frontend configuration.

Startup applies the numbered SQL migrations in `db/migrations`. Migration 003
creates one relational table per backend model, with indexed scalar columns,
foreign keys for primary relationships, and a JSON `payload` column that keeps
the complete API document (including nested arrays/objects). Migration 004
retains legacy dangling notification/favorite references in separate indexed
reference columns while keeping their FK columns valid or null.

The upgrade copies the previously transferred `documents` rows into each model
table with `INSERT OR IGNORE`, in FK dependency order. It is safe to retry and
does not delete or overwrite the legacy documents. Runtime model reads, filters,
counts, ordering, limits, inserts, updates, and deletes target the model tables;
filter values are bound as SQL parameters.

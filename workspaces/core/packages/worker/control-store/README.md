# Postgres control store

This package composes `@mechane/authority-store` and `@mechane/managed-store` into the Worker's `openControlStore`
handle and owns the ordered PostgreSQL schema migration runner (`migrateControlStore`, `DOMAIN_MIGRATIONS`).

Open `openControlStore` inside the Worker request or actor operation and close it in `finally`. Each write operation
owns its transaction. The public API exposes domain operations; PostgreSQL clients (`pg`) remain confined to
`@mechane/authority-store`.

Apply schema migrations with the dedicated migration connection. Earlier schema migrations retain their exact checksums.

Run the package TypeScript check from the factory root:

```sh
mise exec -- workspaces/core/node_modules/.bin/tsc -p workspaces/core/packages/worker/control-store/tsconfig.json
```

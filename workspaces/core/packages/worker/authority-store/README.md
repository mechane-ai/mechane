# Postgres authority store

This package owns the PostgreSQL client pool, transaction context, runtime grants, authentication records, workspace
memberships and policy, encrypted credentials and vault envelopes, provider spend reservations, session usage budgets,
sandbox capacity reservations, and shared managed-store record primitives.

PostgreSQL clients (`pg`) are confined strictly to this package. Higher store packages (`@mechane/managed-store` and
`@mechane/control-store`) compose over `StoreContext` without importing `pg` directly.

Run the package TypeScript check from the factory root:

```sh
mise exec -- workspaces/core/node_modules/.bin/tsc -p workspaces/core/packages/worker/authority-store/tsconfig.json
```

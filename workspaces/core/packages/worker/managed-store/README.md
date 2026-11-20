# Managed Agents catalog store

This package owns the Managed Agents PostgreSQL catalog: versioned agents, environments, installed allocations,
sessions, skills, memory stores and document versions, encrypted vaults and credentials, sandbox evidence, worker
leases, and authenticated git transfer records.

It composes over `StoreContext` from `@mechane/authority-store` without importing `pg` directly.

Run the package TypeScript check from the factory root:

```sh
mise exec -- workspaces/core/node_modules/.bin/tsc -p workspaces/core/packages/worker/managed-store/tsconfig.json
```

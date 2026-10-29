# @mechane/directory-store

The directory object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/directory`

## Layout

- `principals/`: principals, their provider-qualified identities, and their workspaces and memberships.
- `keys/`: issued keys by token hash and by principal, and their revocations.
- `device-approvals/`: device logins from their start through their approval to their claim.
- `browser-sessions/`: the sessions a browser signed in with.
- `sign-ins/`: the GitHub sign-ins a browser started, each claimed once.

## Use

- `openDirectoryStore` opens the store migrated; `atomic` runs one decision and its writes as one transaction.
- Record functions take instants as `DateTime.Utc` and spans as `Duration`, and answer an absent record as an Option.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never decode a row outside its record function.

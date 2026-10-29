# @mechane/workspace-store

The workspace object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/workspace`

## Layout

- `mechs/`: the versioned roster, listed in pages, and creation intents that reserve identity before creating a mech.
- `dispatches/`: the ledger of dispatches, each reserved, then settled with what it spent.
- `leases/`: the machine leases of the workspace's sandboxes, each held until it expires or is released.

## Use

- `openWorkspaceStore` opens the store migrated; `atomic` runs one decision and its writes as one transaction.
- Record functions take instants as `DateTime.Utc`, and answer an absent lease as an Option.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never decode a row outside its record function.

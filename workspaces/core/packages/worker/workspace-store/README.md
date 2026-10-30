# @mechane/workspace-store

The workspace object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/workspace`

## Layout

- `credentials/`: ciphertext and encryption metadata, never credential values or the installation keyring.
- `dispatches/`: the ledger of dispatches, each reserved, then settled with what it spent.
- `leases/`: the machine leases of the workspace's sandboxes, each held until it expires or is released.
- `mechs/`: the versioned roster, listed in pages, and creation intents that reserve identity before creating a mech.
- `policy/`: workspace suspension, sandbox admission, machine limit and daily allowance.
- `slack/`: channel bindings and event admission records.
- `slack-installations/`: workspace installation metadata with credential references.

## Use

- `openWorkspaceStore` opens the store migrated; `atomic` runs one decision and its writes as one transaction.
- Record functions take instants as `DateTime.Utc`, and answer an absent lease as an Option.

## Never

- Never change a deployed migration: append a migration to the store's list.
- Never decode a row outside its record function.

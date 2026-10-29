# @mechane/mech-store

The mech object's database: its tables, rows and record functions.

Layer 3 · worker · plain · consumers: `@mechane/mech`, `@mechane/mech-ports`

## Layout

- `mechs/`: stable identity, desired and active definition revisions, revision history, and pending roster projection.
- `inbox/`: the inbox items a mech received, each once under the id its sender made.
- `turns/`: the turns that take up the inbox items, and how each ends, after any cancel or refusal it records.
- `events/`: the mech's log, which every change of the mech appends its event to.
- `memories/`: the memory changes, pending until their turn ends and never edited once saved.
- `threads/`: the threads a mech's tools open and update.
- `drones/`: the drones a mech started, and how each ends with its report and its machine's stop.
- `forks/`: the forks a mech made, and the copy of approved conversation tables, pi's among them, page by page.

## Use

- `openMechStore` opens the store on the database client the mech shares with pi, migrated; `atomic` runs one decision
  as a transaction queued behind every pi commit before it.
- `mechAlarm` arms the object's one alarm, outside every transaction; `clearMechStorage` deletes the whole database.
- Rows and record inputs carry their instants as `DateTime.Utc`; the tables keep milliseconds.

## Never

- Never change a deployed migration: append a step to `MIGRATIONS`.
- Never decode a row outside its record function.
- Never read or write pi's `pi_` tables, except in a fork's copy, which moves their rows unread.
- Never add a table to the fork allowlist without deciding whether its state may be inherited by a fresh identity.

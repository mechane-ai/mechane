# @mechane/sandbox

The sandbox Durable Object: one mech's or drone's machines and execution receipts.

Layer 4 · worker · plain · consumers: `@mechane/app`

## Layout

- `executions/`: command admission, dispatch, cancellation and receipts.
- `machines/`: machine creation, health, restoration and startup deadlines.
- `providers/`: local host and container machines behind `MachineProvider`.
- `tensorlake/`: native persistent VMs and their maintenance journal.
- `maintenance/`: portable export, import, replacement and deletion.
- `checkpoints/` and `workspace/`: portable R2 generations, transfers and retirement.
- `sources/`: source credential fences and trusted checkout preparation.

## Use

`runExecution` runs a command once under its execution id. While it answers Running, repeat the same request. `manage`
inspects, exports, imports, replaces or deletes workspace files. `stop` ends an ordinary idle machine. A failed
checkpoint preserves its live machine for recovery; an active source fence refuses maintenance and stop.

## Workspace durability

Container commands run serially. Before returning Exited or TimedOut, the object saves the settled command's
`/home/node` files as independent R2 objects of at most 1 MiB, then commits the generation and receipt together.
Replacement machines restore that generation before becoming ready. Missing parts or a failed archive checksum prevent
dispatch. Incomplete command outcomes become Uncertain and never rerun automatically.

The guest stops remaining command processes before archiving; background work and unfinished writes have no persistence
guarantee. Archives allow at most 512 MiB of uncompressed tar data and 256 MiB compressed. Archive creation has a
five-minute timeout; transfers check the same operation deadline between parts. Native R2 calls retain their runtime
completion behavior.

Every command copies the full home, so large repositories require further qualification.

PersistenceFailed retains command output and explains that live files were not saved. The previous committed head stays
intact, and idle or voluntary stop preserves the current machine. A new command can inspect, export or remove files and
try another checkpoint; success clears recovery. Unavoidable machine loss restores the previous head. Obsolete and
failed generations remain queued until their R2 objects are deleted.

Private checkout first checkpoints existing files, destroys the old container, and restores into a fresh guest that has
never run agent code. Only then may it receive a repository token. The durable fence blocks agent commands until token
revocation or confirmed expiry. A failed preparatory save retains the live workspace. Process scope, used by host
fixtures and current Tensorlake guests, refuses real repository credentials before minting.

Provider choice is stored per sandbox. Switching a native installation to Containers fences existing native workspaces
until an explicit import verifies their archive in a fresh guest. Failed imports preserve the previous head. Export
generations remain downloadable while commands advance that head; a new maintenance operation invalidates the export.
See [self-hosting](../../../docs/self-hosting.md) for backup and migration commands.

## Never

- Never rerun an execution whose outcome is unknown.
- Never call a provider before recording its intent.
- Never replace a committed snapshot with an empty workspace after restore failure.

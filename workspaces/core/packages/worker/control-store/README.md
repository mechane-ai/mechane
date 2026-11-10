# Postgres control store

This package owns shared identity, memberships, definitions, current grants, encrypted credentials, spending and machine
capacity. It preserves the earlier SQL history as imported evidence.

Open `openControlStore` inside the Worker request or actor operation and close it in `finally`. Each write operation
owns its transaction. The public API exposes domain operations; clients and SQL stay private. Interactive transactions
retain one connection through commit or rollback.

A provider attempt reserves its maximum charge before dispatch. First dispatch admission rechecks current policy and
caps under the workspace lock. It assigns the charge to that database transaction's UTC day. A repeated mark retains the
original day and reports `wasMarked: false`; it does not authorize another send. Unknown dispatched work remains
charged. Only an undispatched reservation can be released as unused.

Definition and policy changes commit durable control delivery records in their transaction. Delivery claims expire,
retry with bounded backoff, and acknowledge immutable identities. The caller supplies the scheduled recovery sweep.

`captureControlChanges({ run })` gives one operation a domain-store facade on the same pool. Each domain write retains
its own transaction; capture publishes only that operation's committed outbox rows. The HTTP command confirms those
exact recipients after commit through the same delivery owner used by the sweep. No transaction remains open during
actor refresh. A bounded confirmation failure reports saved configuration with unconfirmed runtime refresh; it does not
repeat or undo the mutation. A digest-bound positive acknowledgment cannot be cleared by a late claim failure.

Mech grants and execution access target that mech. Connection changes target its current grant recipients; deletion
records them before removing grants. Credential rotation refreshes MCP-granted recipients whose connection references
that credential. Execution-only credential references resolve on the next command and do not change offered tools.
Workspace policy reaches all mechs. Notification acceptance and reads do not drain control delivery or await discovery.

The actor persists sanitized tool descriptors and availability notices before confirming refresh. Cold startup rebuilds
adapters from this bounded native projection without contacting remote MCP endpoints. The projection grants no access:
each consequential call still resolves its current connection, grant and policy. A fresh scope retains input in the
existing pending owner while preparing its first configuration. Incomplete discovery permits an explicitly partial
loadout, leaves control delivery unconfirmed, and retries through the actor's existing alarm at a 30-second cadence.

`openImportedHistory` needs only a database URL. It holds one read-only repeatable snapshot and requires maintenance
suspension before exporting scoped history. Its fence reports stored facts; the import operator separately supplies
positive retirement evidence for the old owner.

Apply schema migrations with the dedicated migration connection. Steps 1–5 retain their exact checksums. Retire the old
execution owner before applying the new runtime grants. Existing records and historical tables remain intact.

Run the package TypeScript check from the factory root:

```sh
mise exec -- workspaces/core/node_modules/.bin/tsc -p workspaces/core/packages/worker/control-store/tsconfig.json
```

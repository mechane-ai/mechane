---
name: data-sql-store-boundaries
message: Write SQL text and database client calls only in the database owner's store module, each statement once and whole, and never expose the client.
paths: ["**/*.ts"]
---

## Rules

This contract extends `data-store-ownership` to databases that code reads and writes with SQL.
Write SQL text and call the database client only in the store module of the database's owner, including its schema migration steps.
SQL text or a client call in a request handler, a scheduled job, a workflow driver, a domain module, or the class of an object that holds the database is a violation.
A migration runner in the shared utilities module may run the steps that a store module passes to it and keep its own schema version table.

Write each statement in exactly one store function, and call that function wherever the statement is needed.
A schema migration step keeps its own copy of each statement it runs, even when another step or a store function runs the same one, so that no later edit changes what a shipped step runs.
Two statements that differ only in a guard, such as one update with `AND status = $3` and one without, are one statement written twice.
A store function may run several statements that one change needs together, such as a transition that updates a row and appends its event.
Write each statement whole as one literal whose values the client binds as parameters, whether marked as `$1`, as `?`, or by a template placeholder, and never build its text by interpolating text, concatenating, joining, or nesting a fragment, even from trusted text such as a table name chosen in a loop.

Never expose the database client outside the store module, such as in a public field, a return value, or an exported binding.
Never write a function that runs SQL text its caller supplies, such as `readFirstRow({ query, values })`.
Export a store function, such as `runInTransaction`, that runs the caller's store calls in one transaction, so the code owning an operation decides where its transaction starts and ends.
It is the one exported store function that `data-store-ownership` lets carry a storage operation's name.
The composition root that owns the client's lifecycle may construct the client and close it at shutdown, and it or the class that holds the database may pass the client to the store's constructor or factory, such as `createOrderStore({ sql })`.

Configure the repository's lint to fail on SQL text or a client call outside the declared store paths, other than the composition root's construction and shutdown of the client, and on an exposed client, a function that takes SQL text, or an assembled statement anywhere.
Suppress a finding only in the form that `code-lint-suppressions` requires.

Violation: the order driver runs `UPDATE orders SET status = $1 WHERE id = $2` through the store's public client, and the order handler repeats that update with an added status guard.
Allowed: the driver and the handler both call `cancelOrder({ order })`, the orders store's one function for that update.

## Checks

From the repository root, run the lint, and confirm that its store, migration, and runner paths match the ones the repository declares.
For each statement a change adds, is its store function the only one that runs it outside schema migration steps, counting copies that differ only in a guard?
Does each store function that runs several statements serve one change, rather than grouping unrelated statements?
Does an operation that needs one transaction run its store calls inside the store's transaction function?

## Local adaptations

Product Postgres SQL and pg client calls belong to `packages/worker/control-store`. Sandbox SQL belongs to
`packages/worker/sandbox-store` and its shared migration kernel. The owning factory keeps the client private and
exposes typed domain operations. A transaction-bound store composes reads and changes without publishing a raw client.

Pi receives Durable Object storage through its public constructor. Its upstream schemas and statements are not copied
into product code. Actor application documents use public Harness transactions. Chat platform adapters belong to the
integration owner and cannot become an alternative agent or authority store.

`packages/browser/console-cache/src/store/storage.ts` may forward native persistence SQL and bound values unchanged
to enforce cache-generation validity and an operation deadline. TanStack owns those statements and transaction order.
This boundary accepts no application SQL and adds no second queue or Worker protocol.

Each migration keeps the statements it applies. The migration owners `control-store/src/store/database.ts` and
`control-store/src/store/grants.ts` may execute named whole migration statements and previously released adapter schemas.
This exception does not admit caller-supplied SQL or fragments. Grant setup binds the role as a value and quotes it as
an identifier inside its fixed database function. Other runtime store queries remain whole literals with bound values.
The isolated local-stack bootstrap may create its restricted Postgres role through its fixed `psql` setup script.
It exposes no query API to product callers and accepts no user-supplied SQL.
The historical Console fixture in `packages/node/stack/src/fixtures/store/conversation-import.ts` owns its fixed local
Postgres seed and upgrade preparation statements. It accepts typed fixture identities, exposes no query API, and runs
only in the disposable fixture stack. Upgrade checks use the compiled production migrator and authenticated HTTP reads.

Control transitions that must be atomic, such as reserving usage or committing a control-outbox event, execute in one
Postgres transaction. Notification admission and its native submission commit in one Harness transaction. Delivery
between owners uses immutable identities and durable retry; it cannot claim a transaction across both databases.
Checks confine pg imports and the private store context to the control store and inspect PostgreSQL query calls as
well as Sandbox SQLite statements.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `postgres-store-owner` (DO-06): enforced: Keep PostgreSQL clients in the store owner, such as `runtime/src/store/database.ts`
- dependency-cruiser `postgres-context-private` (DO-06): enforced: Keep transaction clients private to the store, such as `runInTransaction` for its callers
- ast-grep `sql-client-outside-store` (DO-06): enforced
- ast-grep `sql-statement-not-literal` (DO-06): enforced
- ast-grep `sql-text-outside-store` (DO-06): enforced
- ast-grep `store-handle-exposed` (DO-06): enforced
- ast-grep `records-type-inferred` (TD-04): a ratchet until phase F2

<!-- End of the generated block. -->

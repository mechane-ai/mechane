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

SQL text and client calls appear only in a store member, `@mechane/store` or an object's `*-store`, or in the stack's `packages/node/stack/src/releases/store`, which writes each release file into celld's local object store as celld's own put does; each migration is a function in its `*-store` member's `src/migrations.ts` that runs its own literal statements, and the store creates its `schema_migrations` ledger and runs the migrations it lacks in one transaction.
A fresh object applies every step its store declares, so its schema revision is that store's step count.
A turn's memory changes save with dense versions in task order in one statement, whose numbering a subquery computes before any row changes.
Each store exports `atomic`, in which a decision, such as approving a device approval or reserving a dispatch, reads and writes as one transaction: the directory's and a workspace's run in `transactionSync`, and a mech's in a transaction of the one database client it shares with pi, queued behind pi's commits, so no host statement joins a pi transaction.
ast-grep `sql-text-outside-store`, `sql-client-outside-store`, `sql-statement-not-literal` and `store-handle-exposed` enforce these rules; the first three scan every member, the node lane's programs too, where the SQL client is a `DatabaseSync` named `database`.
A fork's copy reads every table the database lists, so its page read, its row write and its foreign key read each name a table or column the database itself listed, quoted, with every value bound; each is the one statement a suppression of `sql-statement-not-literal` names, with its reason.
TD-04's ast-grep `records-type-inferred` ratchets each store's `*Records` alias written as an object type, which repeats its factory's object. TD-09's two native return-type rules allow only the registry's exact list of inferred records factories to omit a return annotation; their typed methods define the API once. An inferred alias stays beside its factory or in a consuming parent type file that creates no role-order or dependency cycle. Existing explicit record interfaces remain at their shrinking baseline.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `sql-client-outside-store` (DO-06): enforced
- ast-grep `sql-statement-not-literal` (DO-06): enforced
- ast-grep `sql-text-outside-store` (DO-06): enforced
- ast-grep `store-handle-exposed` (DO-06): enforced
- ast-grep `records-type-inferred` (TD-04): a ratchet until phase F2

<!-- End of the generated block. -->

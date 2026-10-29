---
name: data-record-identifiers
message: Give each new record a random UUID, derive an id only where a retry or rebuild must reproduce it, build each derived kind in one named function, and never parse an id.
paths: ["**/*.ts"]
---

## Rules

Identify each new record, job, or effect by a random UUID, generated where it is created or by the caller that requests it.
Derive an id where a retry or a rebuild must produce the same id again, such as an effect that a retried job must find by id or a row rebuilt from another system's records, and where equal content must share one id, such as a digest of a request's inputs.
Build a derived id from facts that every attempt reads unchanged, or generate it once and store it before the first attempt, never from a value that differs between attempts, such as the current time, a counter held in memory, or a random value generated on each attempt.
Derive no other id.
Build each kind of derived id in one named function that takes its parts as named fields, such as `deriveRefundEffectId({ invoice })`, and build that kind nowhere else.
When code stores a record under a derived id, store each of the id's parts in its own field of that record, and read a part from that field.
An id that code sends to another system, such as an idempotency key, needs no stored parts there.
Never recover a part from an id or branch on its format, such as by splitting it on a separator, taking a substring, matching a pattern, or comparing a prefix.
Validating an id's characters and length where it enters the system is allowed.
Compare or look up an id only as a whole value.

Violation: `const invoice = effectId.split(':')[0]` recovers the invoice from an effect id.
Allowed: a retried job must find its refund effect by id, so `deriveRefundEffectId({ invoice })` builds that id, and the effect row stores `invoice` in its own field.

## Checks

For each id a change creates, is it a random UUID, or does a named retry, rebuild, or content match need to produce the same id again?
For each effect that a retry repeats, does every attempt use the same id?
For each kind of derived id, does exactly one named function build it, and does every record that holds it store its parts in their own fields?
Search the change for splitting, substrings, pattern matches, and prefix comparisons applied to an id.

## Local adaptations

Principals, workspaces, keys, device approvals, mechs, turns, dispatches and machines take ids from `crypto.randomUUID()` where they are created; the Worker generates a key's id with its token, before the directory stores it, and a mech's id before it creates the mech.
An inbox item takes the version 4 UUID its sender made, which `mechane inbox send` prints before it posts, so a resend under the same id is received once and pi admits it once.
Tokens and user codes are secrets and codes, not ids, and a record is found by a token only through the token's SHA-256 hash.
`DIRECTORY_NAME` names the deployment's one directory object and `READINESS_NAME` the object of each class that readiness probes; both are fixed names, not derived record ids.
A workspace's object is named by the workspace's id, and only `mechObjectName({ workspaceId, mechId })` names a mech's object, and its sandbox's object too; the mech's object reads both ids from its own row, never from its name, and the sandbox's object stores no owner id.
A memory change is keyed by its pi tool task's id, so pi's rerun of a memory call answers from the change it recorded, and a turn note's request id is `turn-note:<turn id>`, so a rerun of the alarm finds the note pi admitted; a turn note is never an inbox item, whose request id is a random UUID.
An execution's id is `task-<n>`, its pi tool task's, which only `executionId({ taskId })` in `packages/worker/harness-tools/src` builds, so pi's replay of the task asks for the execution it already started; `ExecutionId` admits only that form.
An id kind's branded schema in `@mechane/protocol` types its ids apart from every other kind's: `TurnId`, `DispatchId`, `ThreadId` and `DroneId` brand `RecordId`, and `ExecutionId` brands its `task-<n>` form.
Each brand lands whole: every protocol schema of its kind decodes under it, and so do the Worker's records and the CLI's inputs of that kind, so a reader's id carries it; a log line names each record by `LogId`, a plain UUID. A kind without a brand takes one in the protocol's records with its first consumer.
An id carries its kind's brand: ast-grep `plain-id-type` ratchets an id property typed as a plain `string`, `plain-id-schema` an id field decoded as `Schema.String`, `RecordId` or `RandomId`, and `bare-random-uuid` a random UUID made outside an id's `make`, such as `TurnId.make(crypto.randomUUID())`.
A machine's id is drawn and stored before its start, and every guest route carries it, so a request reaches only the machine its row names.
Threads and drones take ids from `crypto.randomUUID()` in the transaction that records them, and each row keeps its open_thread or start_drone task's id, so pi's rerun of the call answers the recorded thread or drone; a drone also draws its report item's id there, which its one end takes.
A drone's conversation is found by the session document `mechane.drone` under the drone's id, its brief's request id is the drone's id, which pi admits once, and a drone binds its conversation's provider session id once, which tells its tool calls and dispatches from its mech's.
Only `sandboxStub` names a drone's sandbox, `<mech object name>/drones/<drone id>`, so each drone has its own.
ast-grep `object-name-outside-object-calls` rejects naming a Durable Object outside `packages/worker/bindings/src`, which derives every object's name.
An eval plan's digest is the SHA-256 of its basis's canonical encoding, and only `trialId({ digest, caseId, repeat })` in `packages/node/eval/src` builds a trial's id, the first 128 bits of the SHA-256 of those parts, so a rerun finds each trial's records; the plan stores each trial's case id and repeat in their own fields, and a role's inbox item takes a random UUID that its intent stores.
A fork's new mech takes the random UUID the Worker makes, as `createMech`'s does, and the parent records it in `forks` before it copies anything, and the copy's sequence once the new mech holds it, so a retry of a fork cut off finishes the same mech under that id instead of making another, and never copies over a new mech that holds its copy.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `bare-random-uuid` (TD-14): a ratchet until phase F2
- ast-grep `object-name-outside-object-calls` (044): enforced
- ast-grep `plain-id-schema` (TD-14): a ratchet until phase F2
- ast-grep `plain-id-type` (TD-14): a ratchet until phase F2

<!-- End of the generated block. -->

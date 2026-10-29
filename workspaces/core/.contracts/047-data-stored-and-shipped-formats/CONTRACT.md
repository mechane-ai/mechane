---
name: data-stored-and-shipped-formats
message: Migrate every stored instance and keep what released clients read before narrowing a stored or shipped format.
paths: ["**/*.ts", "packages/worker/app/wrangler.jsonc", "packages/worker/app/cloudflare.example.jsonc"]
---

## Rules

Apply these rules to persisted data, including records in every status, stored documents and snapshots, durable workflow histories, and serialized objects, and to released clients, including published command-line tools, packages, and deployed images.
Treat as a narrowing any change that makes a reader reject a shape still in storage, such as removing or renaming a field, making a field required, narrowing a literal or enumeration, tightening a bound, forbidding extra keys, changing a default, or adding a rejecting validator.
Treat adding an optional field whose default means what old instances meant, or loosening a constraint, as a widening that needs no migration.
Renaming an owned field or member while its mapping keeps the stored or shipped name, as `code-module-structure-and-control-flow` requires for a generic name, is not a narrowing.

Before shipping a narrower reader, migrate every stored instance to the new shape, covering records in every status, including completed and failed ones.
Size each migration for production volume rather than loading every instance into application memory; see `data-sql-schema-rollouts` for resumable batched backfills.
Ship the narrower reader only after a count of old-shape instances in production returns zero.
When some instances cannot be migrated, leave the format unchanged until the data's owner agrees that the remaining instances may stop loading.
Migrate an old stored shape instead of translating it at read time with a rewriting validator, a fallback parser, or a default that fills a field the new code requires.
Give any temporary read path for an old shape a named owner and a removal condition, such as a zero old-shape count after the migration.
Remove an existing read-time translation only after every instance it accepts has been migrated.

Version the format of stored documents that must not be rewritten, such as documents identified by a hash of their content, and give each version its own reader and a converter to the current model.
Keep each version's reader accepting every document it has accepted, with the same meaning.
Within a version, only widen; ship any narrowing as a new version with its own reader, converter, and fixtures, and leave the older readers unchanged.
Before narrowing a model that older versions' readers share, freeze a copy of it for those versions.
Read stored documents with a model separate from the one that accepts new submissions, so that widening for stored data does not loosen new input.
To require a field only of new documents, keep it optional in the stored model and enforce it where new documents are accepted.

Treat durable workflow payload models, and every model they embed, as append-only while any recorded history that carries them can still replay.
Give new payload fields defaults, and remove or retype a field only after every history that carries it has closed.
Ship a workflow change that existing histories cannot replay behind a version gate, after draining those histories, or on a new queue with an explicit cutover of old runs.

Keep each field, route, and literal value that a released client reads until a release that stops reading it has shipped and the client's owner has retired the older releases.
Treat a field, reader, or converter kept because stored data, an open history, or a released client still needs it as part of the current format, not a compatibility shim.

## Checks

Which stores hold the old shape, and which migration rewrites them in every status at production volume?
Parse every stored instance with the changed reader and merge only with zero failures, because a query for one field misses instances that fail for other reasons.
Read the diff itself for narrowings that a schema comparison misses, such as changed defaults, validators, converters, and narrowings inside optional fields, list items, or unions.
Does the diff add a read-time translation without an owner and removal condition, or narrow an existing document version instead of adding a new one?
For a durable workflow payload change, replay recorded histories that carry the changed models.
Does a released client read a removed field, route, or literal value at any release its owner still supports, starting from the oldest?

## Local adaptations

Durable Object migrations are append-only, both the Wrangler `migrations` tags and each store's `MIGRATIONS`, and `/v1` is append-only once deployed.
The service has deployed stored instances, so its locked migrations and shipped formats constrain every change. The name freeze before the first deploy renamed operations, commands, flags, error codes, a variable, tables, indexes, columns and the guest's `command` field in place, editing migrations that no deployment had applied; each of those names is now append-only. Before the first deploy, the directory's, the workspace's and the mech's steps were also collapsed into one first step each, and the Wrangler migrations into `v1`, which adds all six classes.
`lint/wire.json` locks every `/v1` name and member: each operation's method and path, its query, body and output field paths and their closed-set members, the error body's fields and families, each error code with its wire fields and its family, each family with its HTTP status, the CLI's error codes and exit statuses, each event type, and each command, flag and variable; the owned check `locks` fails on a locked name the source no longer declares and on a declared one the lock lacks, which `mise -C workspaces/core run locks` appends, so a shipped name only ever joins.
`lint/migrations.json` locks every schema step: each store's `MIGRATIONS` entry under its Durable Object class, by its position and the hash of its code without comments or formatting, and each Wrangler migration by its position, its tag and the hash of its entry; the same check fails on a step the lock holds that the source changed, moved or removed, and the same task appends a new one. Keying a store by its class keeps its entries when its file moves.
The check holds each lock to the source, and the deploy holds it to what shipped: an entry edited or removed together with the source passes the check, so changes to `lint/` require maintainer approval, and the deploy refuses a lock edit that disagrees with shipped formats.
`SendInboxItemBody.delivery` defaults to `when_idle`, and that default is part of `/v1`; `inbox_item.received` carries the item's `delivery`, a leaf member read tolerantly.
`/v1` gains `cancelTurn`, `listMemories`, the delivery `interrupt`, the reason `canceled` and the event `turn.canceled`.
`/v1` gains `listThreads`, `listDrones`, `showDrone`, `cancelDrone`, the errors `DroneNotFound` and `DroneEnded`, and the events `drone.started`, `drone.reported` and `drone.unreported`.
The guest's wire in `@mechane/protocol` is a shipped format, since a Worker can meet a guest of an older image: it refuses excess fields, so a new field needs a new route.
pi stores the bash tool's name, `bash`, in every call, and its extension's name, `mechane.hands`, so both are stored formats; so are the memory extension's name, `mechane.memory`, its tools' names, `memory_read`, `memory_write`, `memory_delete` and `handoff`, and its section's key, `memory`; so are the threads extension's name, `mechane.threads`, its tools' names, `open_thread`, `update_thread` and `start_drone`, and its section's key, `threads`.
A mech stores each event as `/v1` encodes it, so the stored event and the wire's are one format; pi stores the provider id `mechane`, the inbox item entry kind `mechane.inbox_item`, the turn note's entry kind `mechane.turn_note` and request-id prefix `turn-note:`, a drone's brief's entry kind `mechane.drone_brief`, the drone document's kind `mechane.drone`, and its own tables under the prefix `pi_`, which the harness declares as constants because changing one strands stored data.
The CLI's JSON envelope, its command reference and its saved login carry schema versions that a narrowing change increments; the first release ships the reference at 4 and the envelope at 3, whose error records also carry each error's own fields.
The releases bucket's keys and the release manifest are shipped formats, since every installed CLI and each served `install.sh` read them: `cli/latest.json`, and in each release's folder `cli/v<release>/` its `manifest.json` and a `mechane-<target>` for each target.
A published release's files never change, so a changed binary needs a new release, and `release:upload` refuses a release whose manifest the bucket holds. A reader skips a target it does not know, since the manifest keys binaries by target as text. `install.sh` reads the manifest as text, so no value may hold a comma, a brace or a quote, no other field may be named `release`, and a binary's `path` and `sha256` must precede any object in its entry.
`/v1` gains `showAllowance`, and refuses a text with half of a UTF-16 surrogate pair alone, which no row holds and which the deployment answered with `ObjectUnavailable` before. An eval run's suite file, plan and report carry a `version` that a narrowing change increments, and a rerun refuses an out folder whose plan has another digest, so its records never mix two plans. A trial's records carry no version of their own: a narrowing of any of them increments `PLAN_VERSION`, which the digest covers, so a rerun refuses an older out folder as `PlanChanged`.
A newer deployment's `/v1` may add a member to a closed set its responses carry: an event type, a delivery, an unanswered reason, a turn's, a drone's or a dispatch's status, a settlement basis, a thread state, a membership role, a key purpose or a Durable Object class. A client decodes a member it does not know as an unknown member, so a newer deployment never breaks an older CLI: a leaf member is its text under the `UnknownMember` brand, and a record of a kind it does not know is its kind's unknown variant, `UnknownEvent`, `UnknownTurn`, `UnknownDrone` or `UnknownDispatch`, which keeps the fields every kind shares and its others as the wire wrote them, so `--output json` writes it whole and its text line names it and says to update.
Known members stay strict in structure: a known kind with a missing field, or a field of another type, id form or character class, still fails to decode, an unknown member must be printable text, and every request body refuses one. Limits on what a caller may send bind only requests and tool arguments: the length of a text or name and the version of a caller-made id. Every response, event and error field reads its record form instead, `RecordId`, `RecordText` or `RecordName`, which accepts any text that a 2 MB row holds and that its request form admits, so a later deployment may raise a limit or accept another UUID version without breaking an older CLI. Formats the deployment itself makes stay strict: a key's and a poll's token, a user code, a memory digest, an allowance's day and a sequence from 1. Leaf members read tolerantly wherever a shared record schema is read; a record union takes its unknown variant only in an operation's output and in the Worker's read of its stored events, so a rollback across an added event type still lists the log, and the smoke reads a trace's and a drone's records strictly.
The owned check `record-forms` fails on a field of an operation's output or of an error whose text JSON Schema bounds below a row's, or whose id it writes as a version 4 UUID; a minimum length, and a byte bound that only a filter states, stay for review.
A poll's status and an error's family stay closed, since the CLI acts on them: a new poll answer ships as a new operation, and a client reads an error code it does not know by its family. `/v1` ends a turn only with `turn.answered` or `turn.unanswered`, and a drone only with `drone.reported` or `drone.unreported`, so a new way to end one ships as a new reason, which an older CLI's follower and eval runner still read as an end.
A turn's reply is cut at 524,288 UTF-16 units where the mech builds `turn.answered`, and a drone's report at 32,768 where it ends; `/v1` reads both as record text, so a later deployment may raise either cut up to a row's worth.
A mech's `forked_from`, in its `mech` row and in the workspace's index of `mechs`, stores the fork point as `/v1` encodes it, so the column and the wire's field are one format.
`/v1` gains `forkMech`, the error `MechBusy`, the event `mech.forked`, which an older CLI reads as an `UnknownEvent`, and a mech's `forked_from`.
A fork copies its parent's tables row for row, pi's among them, so a parent and its new mech must run one release; an object of another release fails the copy, which a retry starts again, rather than mixing formats.
Every model request names its conversation's provider session in the `x-session-id` header, as pi-ai sends it to OpenRouter.
`/v1` gains the errors `RateLimited`, family `rate_limited`, whose `retry_after_seconds` the `retry-after` header repeats, and `WorkspaceSuspended`, family `forbidden`; an older CLI reads either by its family.
The release manifest gains `revision`, the clean worker revision of the tree its release was built from; `REVISION_PATTERN` keeps it free of what `install.sh`'s text reading forbids.
The Worker's log lines are a shipped format, since an operator's log search reads them: `LogLine` in `@mechane/protocol` declares each event and its fields, written as one JSON object with snake-case keys; a new event or field widens it, and renaming either narrows it.
Every model request names its workspace's id as `user`, the end-user id that OpenRouter's chat completions take.
Every request of the CLI names its release in `user-agent`, `mechane/<release> (<target>)`, and the deploy program's `mechane-deploy/<release>`, which is how the operator sees which releases still call.
The deploy program refuses a deploy unless every entry of the deployed tag's two locks, read with `git show`, stays in this tree's, which this tree's check held to its source, so the locks alone decide what only appends. A rollback needs the two tags' migration locks to be equal, their wire locks to hold the same `/v1` operations, and the tags to share the git objects of `packages/node/guest`, of the shared members it bundles (`packages/shared/deployment`, `records` and `sandbox-wire`, and `packages/shared/protocol` apart from `src/release.ts`, which holds `RELEASE`), and of the lockfile, from which the sandbox image builds, since a rollback leaves the image as the later release built it; any other change rolls forward with a patch release.
Renaming an owned field while `renamedWireStruct` keeps its shipped key, as 007 requires for a generic name, is no narrowing.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- owned check `locks` (CP-07): enforced in phase B
- owned check `record-forms` (047): enforced in phase B

<!-- End of the generated block. -->

---
name: data-stored-and-shipped-formats
message: Migrate every stored instance and keep what released clients read before narrowing a stored or shipped format.
paths: ["**/*.ts", "packages/worker/sandbox-service/**"]
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

The November 2026 native-runtime cutover replaces the Pi and Durable Object agent stores, old workflow histories,
and superseded public operations without a compatibility reader. The owner explicitly authorized fresh product
state for this cutover. Legacy format-lock entries do not require retaining the old execution engine. This is a
one-time deployment baseline, not permission for later releases to discard data or narrow active workflow payloads.

After that baseline, apply the stored-data and active-history rules above to Mechane Postgres records and Workflow
histories. Coordinate code and schema changes for overlapping service versions. Keep immutable release assets and
recorded execution receipts meaningful across retries. The sandbox guest wire remains a separately deployed boundary;
change its caller and image together or use an explicitly versioned endpoint.

The admitted Console cache contains derived server records and page metadata only. Its owner may advance the cache
generation and discard incompatible copies after server admission. This exception excludes authoritative server data,
credentials, drafts, unsent commands, and submission acknowledgements.

Native AI SDK messages and streams use the upstream format. Structured presentation records keep their validated
catalog/spec and readable fallback. Domain API encoders remain declared once in the protocol package. A later SDK
upgrade must qualify stored-message reads, stream replay, and pending workflow resumption before publication.

Public release files are immutable. A changed artifact requires a new release and checksum. The CLI's saved-login,
JSON-envelope, command-reference, and eval-plan versions remain the responsibility of their owning declarations.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- owned check `locks` (CP-07): enforced in phase B
- owned check `record-forms` (047): enforced in phase B

<!-- End of the generated block. -->

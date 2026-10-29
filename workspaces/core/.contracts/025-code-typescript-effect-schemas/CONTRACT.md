---
name: code-typescript-effect-schemas
message: Decode every value that crosses a TypeScript boundary with an Effect Schema, reject unknown fields on owned shapes, and give each schema and its type one PascalCase name.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Decode every value that crosses a boundary, such as a request body, a stored record, an environment variable, a message from another process, or a model's output, with an Effect Schema before code reads it.
Name each schema constant in PascalCase for the value it decodes, such as `Invoice`, never in camelCase or with a `Schema` suffix, such as `invoice` or `InvoiceSchema`.
Declare each schema once, and derive its type once, directly below it, in an alias that shares the schema's name, written `type Invoice = typeof Invoice.Type`.
Refer to that alias everywhere else, and never write a schema's derived type inline, such as `(input: typeof Invoice.Type)`, or under another name.
Never write a type by hand that repeats a schema's shape.
A schema built from a closed set's declaration may take its type from that declaration.
Write such a schema inline where a field or a decode uses it, such as `status: Schema.Enum(OrderStatus)`, so the set never needs a second name.
A schema class, such as `class Invoice extends Schema.Class<Invoice>('Invoice')({ ... }) {}`, is its own type and needs no alias.
A function built from a schema, such as a decoder or a guard, is not a schema and keeps a camelCase name, such as `decodeInvoice` or `const isInvoice = Schema.is(Invoice)`.
Never read a property of a value that a schema accepted as any value, such as `Schema.Unknown` or `Schema.Any`, until another schema decodes it.
Turn a decoding failure into the boundary's typed error, such as a rejected request or a failed job, and never into a default value.
When a framework accepts a common validator interface instead of its own schema type, pass the Effect schema through that interface instead of rewriting it in another library.
Use no other validation library, except one the repository declares for a named consumer that Effect Schema cannot serve, such as a generator that reads only that library's schemas.

An owned shape is one this repository declares for data it writes or accepts, such as its request bodies, stored records, settings files, and internal messages.
A foreign payload is one that another system declares and may extend, such as a provider's webhook or response, request headers, or the process environment.
Reject unknown fields on every decode by passing `{ onExcessProperty: 'error' }` beside the schema, such as `Schema.decodeUnknownEffect(Invoice, { onExcessProperty: 'error' })`.
Mark each foreign payload loose in its own schema by declaring its other fields with an index signature, such as a `Schema.StructWithRest` whose rest is `Schema.Record(Schema.String, Schema.Unknown)`.
Never mark an owned shape loose, so a misspelled or removed field fails its decode instead of disappearing.
When a framework or a common validator interface decodes a value for the code, give it the same option, such as `Schema.toStandardSchemaV1(Invoice, { parseOptions: { onExcessProperty: 'error' } })`.
Making an existing reader of stored or shipped data reject unknown fields narrows it, so ship that change only as `data-stored-and-shipped-formats` allows.

Configure the repository's lint to reject a schema constant whose name is not PascalCase, a derived type outside its alias, and a decode call without `onExcessProperty: 'error'`.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.
Suppress a finding only as `code-lint-suppressions` allows.

Violation: `const invoice = JSON.parse(body) as Invoice` trusts the body's shape.
Violation: `const invoiceSchema = Schema.Struct({ ... })` beside `type InvoiceRecord = typeof invoiceSchema.Type` gives one concept two names.
Violation: `Schema.decodeUnknownEffect(Settings)(file)` drops a misspelled `retrys` field, so the setting silently keeps its default.
Allowed: the handler decodes the parsed body with `Schema.decodeUnknownEffect(Invoice, { onExcessProperty: 'error' })` and reads only the decoded value, typed by `type Invoice = typeof Invoice.Type`.
Allowed: a webhook's `ProviderEvent` schema declares the one field code reads and a `Schema.Record(Schema.String, Schema.Unknown)` rest, and is decoded with `onExcessProperty: 'error'`.

## Checks

From the package directory, run the package's type check.
Run the repository's lint from the repository root, and confirm that it reports a camelCase schema constant, an inline `typeof Invoice.Type`, and a decode call without `onExcessProperty: 'error'`.
Search the change for imports of validation libraries other than Effect Schema, and confirm that each one serves a declared consumer.
For each boundary a change adds, which schema decodes it, and where is its type's one alias?
For each schema a change marks loose, does another system declare the payload, and for each one it leaves strict, does this repository own the shape?
For each existing reader of stored or shipped data that a change makes reject unknown fields, which migration or count shows that no stored instance carries one?

## Local adaptations

TypeBox, pinned in `@mechane/harness-tools`, is declared only for the parameters of pi's tools, since pi's `defineTool` takes no other schema, and its confine in `dependencies.json` keeps it inside `@mechane/harness` and `@mechane/harness-tools`; pi checks a tool's arguments against it, and the bash tool then decodes them with the protocol's `ExecutionRequest`, each memory tool with the protocol's `MemoryPath`, `MemoryText` and `MemoryDigest`, and each threads tool with the protocol's `ThreadTitle`, `ThreadNote`, `ThreadId`, `ThreadState` and, for a drone's brief, `InboxText`, before it reads them; the memory and threads tools' TypeBox parameters carry no bounds, and a description that names a limit interpolates the protocol's constant.
Decoded names follow the naming contracts, and wire keys derive from them.
Each schema a schemas file exports has its type beside it, as `export type Turn = typeof Turn.Type`, so every other form of the entity names that type (TD-12): ast-grep `schema-alias` rejects one without, and `mise run fix` declares it, and a pi tool's TypeBox parameters, which carry no `Type`, need none. The rule reads the schemas files only, since the placement normalizer moves every schema that another file uses into one.
`wireKey` in `@mechane/protocol` writes a field in snake_case without its boolean prefix, as `self_grading` for `isSelfGrading`.
`wireStruct`, which `@mechane/protocol` exports, derives each key of a struct with it, as the CLI's eval records do. `renamedWireStruct` takes a key it cannot derive from `renames`, as `has_more` for `hasMore`, which `wireKey` would write as `more`, since an optional `renames` would hold an absent value outside an `Option`.
Their `WireKey` type spells the same derivation, so a struct's encoded type names its keys; a struct that predates them lists its keys in `Schema.encodeKeys`, which ast-grep `encode-keys-outside-records` ratchets outside `packages/shared/records/src`.
The router decodes each request part, and the CLI each command's input, with excess properties refused; `NoFields` in `@mechane/protocol` is the part without fields, because an empty `Schema.Struct` passes every key through.
An eval run decodes its suite file with excess properties refused, and a grader's reply with `GradeReply`, whose failure is the trial's `no_grade`.
Code encodes its own output with `Schema.encodeSync` (EF-16): oxlint `no-restricted-properties` ratchets `Schema.encodeEffect` and `encodeUnknownEffect`, and ast-grep `decode-or-die` rejects a decode piped into `Effect.orDie` or passed to it, which would make a failure the boundary expects a defect. ast-grep `encode-sync` rewrites a yielded `encodeEffect(S)(v).pipe(Effect.orDie)` to `encodeSync(S)(v)` when a sweep or, once enforced, `mise run fix` runs it. The three sites left are in the deploy program's rollout and the live release verification, which only an operator runs, and two of them have the shape `encode-sync` rewrites.
`Schema.is` narrows only to an `Unknown*` member (EF-16), a clause no rule checks, so review holds it: 12 sites narrow to another schema, such as `RateLimited` in the router's failure answer, and phase F3 decodes them instead.
A store decodes its rows through the store kernel's `decodeRows`, `decodeOne`, `decodeFirst` and `decodeNonEmptyRows`: ast-grep `store-row-decode` rejects a `Schema.decode` call in a store outside `packages/worker/store/src`, and oxlint `no-restricted-properties` ratchets `Schema.decodeUnknownOption`.
Every untyped boundary answers `unknown` (TD-11): the registry writes `lint/types/<lane>/strict-globals.d.ts` for each lane, which the lane's program names and each member's program inherits, so `JSON.parse` and the `json()` of each body of `jsonBodies` return `unknown`. In the worker lane those are `Response`, `Request` and `R2ObjectBody`, since Cloudflare's types declare `Body` as a class. ast-grep `json-type-argument` rejects a `json` call with a type argument, which would still assert the body's type, and oxlint skips the generated declarations.
Every text of a wire, RPC or stored schema is bounded (TD-26): ast-grep `bare-string-schema` ratchets a bare `Schema.String` in `protocol`, `sandbox-wire`, `rpc` and each `*-store`, except ER-02's `reason`, a record's key, a redacted value, a patterned or checked string, and an id, which `plain-id-schema` counts; bounding the 71 it holds changes what a decode refuses, so each waits for its field's bound.

The v11 strict excess-property decoder rule is outside the current adoption baseline at commit 94f2d0f.
Existing stored and shipped readers keep their tolerant decoding, which contract 047 requires for future-compatible fields.
A rollout that narrows a reader needs format-specific evidence and a migration decision before it changes runtime behavior.
The new schema-name and derived-type syntax checks are staged with that rollout; the shipped assets stay unloaded.
Existing schema-alias and boundary checks remain enforced.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `jsonBodies` `shared` [`Body`], `worker` [`Response`, `Request<CfHostMetadata = unknown, Cf = CfProperties<CfHostMetadata>>`, `R2ObjectBody`], `node` [].
- oxlint's restricted members (TD-22): a ratchet until phase F2: `Schema.decodeUnknownOption`
- oxlint's restricted members (EF-16): a ratchet until phase D: `Schema.encodeEffect`, `Schema.encodeUnknownEffect`
- ast-grep `decode-or-die` (EF-16): enforced in phase D
- ast-grep `schema-alias` (TD-12): enforced in phase D
- ast-grep `encode-sync` (EF-16): a ratchet until phase D
- ast-grep `encode-keys-outside-records` (CP-06): a ratchet until phase F2
- ast-grep `store-row-decode` (TD-22): enforced in phase F2
- ast-grep `bare-string-schema` (TD-26): a ratchet until phase F2
- ast-grep `json-type-argument` (TD-11): enforced in phase C2

<!-- End of the generated block. -->

---
name: data-and-apis
message: Keep authoritative facts and explicit outcomes behind small, usable APIs.
paths: ["**/*.ts"]
---

## Rules

Store authoritative facts and derive dependent values.
Materialized summaries and caches are useful when their owner defines how they stay consistent; they must not become competing sources of truth.
Keep units, identifiers, and the revisions that produced a value explicit and consistent across the affected flow.

Represent distinct outcomes explicitly when independent optional fields or booleans permit contradictory states.
For example, a graded result contains a grade; a failed result contains an error.
Raw provider evidence may accompany either result for diagnosis without deciding success.
Keep missing evidence, an unavailable provider, and an empty successful result distinct; never turn an error or incomplete coverage into a zero value or an empty success.

Validate untrusted inputs at their entry point, then use the established domain representation internally.
Revalidate when crossing a new trust boundary.
Keep provider and persistence formats in their adapters unless the format is itself the intended API.
Never read or write another service's database tables as an integration API; use the interface that service declares.
Pass only the data an operation needs; avoid unrestricted context objects.

Review API changes from actual callers.
Remove unused parameters, redundant conversions, and obsolete options made unnecessary by the new model.
Do not add a flag or wrapper to compensate for a representation that should change.

## Checks

Follow one representative input through execution and output.
Can two fields disagree about the same fact?
Can the type express an impossible outcome, or can an unavailable provider or incomplete coverage produce an empty success?
Does a caller repeat validation, reinterpret an error, or repair a result?
Check serialization and all affected callers when changing a representation.
Use types for structural guarantees and focused tests for conversions and behavior.

## Local adaptations

Wire JSON keys are their fields in snake_case, as `wireKey` derives them; money is integer `_micros`, wire times are RFC 3339 strings, and stored times are epoch milliseconds under `_ms` names.
An error body carries its family, its code, the deployment's message and the error's own fields under snake_case keys, so a client tells an error from an empty result and decodes a code its call expects into that error with its fields, as `OperationFailed` holds it, while any other code is an `UnknownFailure` it reads by the family; the CLI's error record carries the same fields.
A call expects the errors its operation declares, those `ACCESS_FAILURES` declares for the operation's access and the `ROUTE_FAILURES` of every request, and a read of a release file `RELEASE_FAILURES` and the same route failures; the Worker's admission is typed by `ACCESS_FAILURES`, so it cannot fail in a way a client does not expect.
A list that grows pages: it takes `after`, the id of the last record a reader has, and answers its records oldest first, in the order the deployment recorded them, with `has_more`; the Worker picks the page size, which no client reads, and an `after` that names no record of the caller's list is `RequestInvalid`. Memories and workspaces are bounded and answer whole.
A mech's events page by sequence: any sequence from 0 is a cursor, and one past the log's end waits for the next event.
An exhausted allowance or mech cap is a turn's outcome, `allowance_exhausted`, never an error of a call, and so is a cancel, `canceled`; a cancel of a turn that ended before any cancel is `TurnEnded`, a conflict, while a repeated cancel answers the first; a dispatch's price sums tokens times rates in BigInt and divides once, rounding up, and the trace derives nothing it does not store.
An eval trial's grader outcome is `graded` with its grade, `no_grade` with the issue its reply has, or `unanswered`, and the report derives each verdict from the saved records alone; its `charged_micros` count only settled dispatches of saved turns, and a turn that was never saved leaves its trial `unavailable` rather than charged nothing.
A store answers an outcome as a tagged value, and ast-grep `store-boolean-answer` fails on a store function that returns a `boolean`.
Absence is an `Option`: ast-grep `nullable-type` ratchets `null` or `undefined` in an owned type, outside the type arguments of the TypeScript library's and a dependency's generics, which follow that dependency, and `Schema.NullOr`, `UndefinedOr` and `NullishOr`, `nullish-operator` each `??` and `?.`, and `nullish-comparison` rejects a comparison with `null` or `undefined`; `no-optional-property` rejects an optional property.
oxlint `unicorn/no-useless-undefined`, with `checkArguments` and `checkArrowFunctionBody` off, rejects a `return undefined` and an `undefined` default, while an outbound call's `.then` keeps `() => undefined` as its first handler.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `no-optional-property` (TD-18): enforced in phase D
- oxlint `unicorn/no-useless-undefined` (TD-18): enforced in phase D, `["error",{"checkArguments":false,"checkArrowFunctionBody":false}]`
- ast-grep `nullable-type` (TD-18): a ratchet until phase F2
- ast-grep `nullish-comparison` (TD-18): enforced in phase F2
- ast-grep `nullish-operator` (TD-18): a ratchet until phase F2
- ast-grep `store-boolean-answer` (TD-17): enforced in phase F2

<!-- End of the generated block. -->

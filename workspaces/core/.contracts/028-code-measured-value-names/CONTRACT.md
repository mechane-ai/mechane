---
name: code-measured-value-names
message: End the name of every numeric limit, duration, and bound with a declared unit, counted noun, or unitless measure that the repository's lint enforces.
paths: ["**/*.ts"]
---

## Rules

Include the unit in the name of a limit or duration whose type does not carry it.
Declare a list of unit suffixes, such as `Ms`, `Seconds`, `Bytes`, `Chars`, and `Usd`, and spell each one the same way in every language of the repository, changing only its case, such as `timeoutMs` and `timeout_ms`.
Declare a list of measure words, such as `timeout`, `deadline`, `delay`, `interval`, `limit`, `size`, and `budget`, and a list of counted nouns and unitless measures, such as `Attempts`, `Pages`, and `Ratio`.
Configure the repository's lint to reject a numeric constant, variable, field, class field, parameter, or schema key whose last word is a measure word or whose first word is `max` or `min`, unless its last word is a listed unit, counted noun, or unitless measure, such as `maxAttempts`.
Add to the lists only a unit, a counted noun, or a unitless measure, never a word that names neither, such as `Value` or `Amount`.

A value whose type carries its unit, such as a duration, a date, or a named unit type, needs no suffix.
Convert a value to another unit only into a name that carries the new unit, such as `timeoutMs = timeoutSeconds * MILLISECONDS_PER_SECOND`.
Write a name that another system fixes, such as a library's `timeout` option or a wire field, only in the call or mapping that meets that system, map it there to or from a name or type that carries its unit, and suppress any finding that remains as `code-lint-suppressions` requires, with a reason that names that system.
Keep the external name of a stored or shipped field that the repository owns, as `data-stored-and-shipped-formats` requires, through a serializer rename where one exists and otherwise with a suppressed finding.
Exempt generated files and copied third-party source from these rules by a declared path pattern, and map each limit or duration they carry to a name or type that carries its unit where owned code first reads it.

Violation: `const UPLOAD_LIMIT = UPLOAD_LIMIT_MEBIBYTES * BYTES_PER_MEBIBYTE` is compared with a body's byte length, and its name does not say bytes.
Allowed: `UPLOAD_LIMIT_BYTES`, `timeoutSeconds`, `maxAttempts`, and a `retryDelay` whose type is a duration.

## Checks

Run the repository's lint on the changed files, and confirm it reports no limit, duration, or bound without a listed unit, counted noun, or unitless measure.
For each numeric limit or duration that the lint cannot see, such as one returned by a call, does its name or its type carry its unit?
For each value a change converts to another unit, does the new name carry the new unit, and does the flow keep one unit as `data-and-apis` requires?
Does the change add a list entry that is neither a unit, a counted noun, nor a unitless measure?
For each suppression of this rule that a change adds, does its reason name the system that fixes the name?

## Local adaptations

The measure words are `measureWords`; the units and the counted nouns are the word lists `units.txt` and `counted-nouns.txt` in the registry's `src/vocabulary`, which any change may extend.
ast-grep `measured-value-names` rejects a numeric name whose last word is a measure word, or whose first word is `max` or `min`, without a listed unit or counted noun, in a variable, a parameter, a property signature, a class field, or a field of an object a declaration names; it matches the generated utilities `measure-word` and `unit-suffix`.
A duration that Effect's `Duration` type carries, such as `STARTUP_TIMEOUT`, needs no suffix.
A bound names its subject first, as `<SUBJECT>_MAX_<UNIT>`, such as `EXECUTION_MAX_BYTES`, or `<SUBJECT>_MAX` for a `Duration`, such as `WAIT_MAX`: ast-grep `bound-order` rejects a declaration named `MAX_…`.
`Micros`, `Tokens`, `Bytes` and `Sequence` in `@mechane/protocol` brand a non-negative integer: the protocol's money, token counts, omitted output bytes and event places decode under them, and arithmetic re-enters a brand through its `make`. `Chars` lands with its first field.
A measured value carries its unit's brand: ast-grep `raw-money-number` ratchets a field named for `Micros`, `Tokens`, `Bytes`, `Chars` or a sequence that is typed `number` or decoded by `Schema.Int`, `Number`, `Finite` or `NonNegativeInt`.
A time is an instant or a span in every Type (TD-16): ast-grep `raw-time-number` ratchets a `number` property named for a time, by a unit suffix, a measure word or `At`, and `raw-time-schema` a schema field so named that a number schema decodes, since only an Encoded form keeps milliseconds; `waitFor` and `settlesWithin` take a `Duration`, as the stack's reply hold and the directory's lifespan do.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `measureWords` `timeout`, `deadline`, `delay`, `interval`, `limit`, `size`, `budget`, `duration`, `grace`, `allowance`, `cap`, `lifetime`, `window`, `ttl`, `age`, `period`, `threshold`.
- ast-grep `measured-value-names` (NM-08): enforced
- ast-grep `bound-order` (NM-08): enforced in phase D
- ast-grep `raw-money-number` (TD-15): a ratchet until phase F2
- ast-grep `raw-time-number` (TD-16): a ratchet until phase F5
- ast-grep `raw-time-schema` (TD-16): a ratchet until phase F5

<!-- End of the generated block. -->

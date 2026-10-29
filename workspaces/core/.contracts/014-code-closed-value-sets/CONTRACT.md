---
name: code-closed-value-sets
message: Declare each closed set of values once, HTTP methods and status codes included, name its members instead of their literal values, and test membership with a module-level set.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

A closed set is a fixed list of values that code compares against, branches on, or offers as choices, such as an order's statuses or the kinds of event a parser reads.
Declare each closed set once, as a named type whose members code refers to by name, such as an enum or a constant object of named members.
Compare, branch on, and key maps by the set's members, such as `case OrderStatus.Refunded`, never by repeating a member's literal value, such as `case 'refunded'`.
Derive validation schemas, lookup tables, and lists of the set's values from that one declaration instead of repeating its values.
The declaration holds each literal value once, a stored or wire value included, and a migration keeps the literals it wrote, which must not change with the set.
A comparison against a value that the language or a protocol defines, such as a type-of operator's result, is allowed, except an HTTP method or status code.
An error's tag, which its error class declares once, is allowed as a literal in a tag comparison or a tag handler's argument when the type checker rejects a tag outside the error type.
A member's literal value is allowed as a key of a style definition whose library compiles only literal keys, when the type checker rejects a key outside the set.
Give an open set of values, such as configured model or region identifiers that change without a code change, a named type instead of a closed declaration.
Declare a closed set for the members of an open set that code branches on, such as the models that need special handling.

Declare each whole closed set, and each subset of two or more members, that code tests membership in once, as a module-level read-only set; compare one member directly.
Use the language's read-only set type, such as `ReadonlySet<SandboxState>` or `frozenset`, or a constant array where a module constant cannot hold a set, such as a `const` slice.
Test membership with that declaration's lookup, never with a collection, comparisons, or a pattern written at the test, even for two members, such as `[A, B].includes(state)`, `new Set([A, B]).has(state)`, or `state === A || state === B`.
Where such a test must narrow the value's type, or no constant can hold the members, branch with a case or arm for every member instead.

Name each HTTP method and status code through a declared closed set whose members hold the protocol's values, such as `HttpMethod.Post` and `HttpStatus.MethodNotAllowed`.
Use those members wherever code writes, passes, or compares a method or status code, such as `{ status: HttpStatus.NotFound }` instead of `{ status: 404 }`.
Derive any type of methods or status codes from the set's declaration, never from a literal union that repeats its values, such as `'GET' | 'POST'`.
Put each set's declaration in a module that holds only that declaration, unless the standard library or a dependency already exports the set with named members.
A status code is also a numeric literal under `code-numeric-literals`, and its named constant is the status set's member, never a second constant such as `NOT_FOUND = 404`.
Test files, matched by a declared path pattern, may write HTTP methods and status codes as literals, because a test states the exact values it sends and expects.

Configure the repository's lint to report each HTTP method literal outside the declaring modules and the test files.
Configure it also to report, in the same files, each status code under a status name that the lint of `code-numeric-literals` skips, such as `{ status: 404 }`.
Configure it also to report, in every file, literals or members listed where code tests membership in them, and a named array used only for membership tests.
Where the repository's lint can load this contract's `assets/` configuration, load it from the repository's own lint configuration, and suppress a finding only as `code-lint-suppressions` allows.
Its patterns, which a repository may override, find the declaring modules by the names `http-method` and `http-status`, test files by common paths, and one library's style definition call.

Violation: `switch (order.status) { case 'refunded': ... }` repeats a stored value that the order schema already declares.
Violation: `fetch(url, { method: 'POST' })` writes the method as a literal, which compiles even when misspelled as `'POTS'`, because the request's method is a plain string.
Violation: `if ([SandboxState.Stopped, SandboxState.Failed].includes(sandbox.state))` lists the ended states at the test, so each other test of them repeats the list.
Violation: `state === SandboxState.Stopped || state === SandboxState.Failed` and `matches!(state, SandboxState::Stopped | SandboxState::Failed)` list the ended states at the test instead of reading the declared set.
Allowed: `case OrderStatus.Refunded:` names the member, and `OrderStatus` is the one declaration that the schema and the switch both read.
Allowed: `fetch(url, { method: HttpMethod.Post })` and `if (response.status === HttpStatus.NotFound)` name members of the declared sets.
Allowed: `const endedStates: ReadonlySet<SandboxState> = new Set([SandboxState.Stopped, SandboxState.Failed])` at module level, tested as `endedStates.has(sandbox.state)` wherever code asks whether a sandbox ended.
Allowed: a style definition whose type argument is `Record<Tone, Style>` writes a key for each value of `Tone`, such as `neutral`, because the type checker rejects any other key.
Allowed: `switch (event.kind)` with one shared case for `EventKind.Opened` and `EventKind.Reopened` and a case for every other member branches on the set, as `code-exhaustive-branches` requires.

## Checks

Run the repository's lint from the repository root, and confirm it reports a method literal and a numeric status property outside the declaring modules and tests, `[A, B].includes(state)`, and `state === A || state === B`.
Search the change for `case` labels and equality comparisons against string or number literals, and name the closed set each one belongs to.
For each closed set the change touches, where is its one declaration, and do schemas and lookups derive from it?
Does the change write an HTTP method or status code without its set's member, such as in a local constant, a `code` property, or a longer string?
Does the change branch on a configured identifier without a declared closed set for the values it handles?
For each membership test a change adds that the lint passes, such as a local array or a list in another language, does it read a declared module-level set?
For each style definition a change keys by a closed set's literal values, does its type reject a key outside the set?

## Local adaptations

A closed set is an `as const` object of named members with the union of its values as a type of the same name, such as `ErrorFamily` or `ExitStatus`.
ast-grep `literal-comparison` rejects comparing with or casing on a string literal, except a type-of result and the empty string.
`SUCCESS_STATUS`, the exit status a process reports on success, is a value the operating system defines.
HTTP methods, status codes, header names and media types are SC-12's sets in `@mechane/records`.
Each is declared alone in its concept constants file: `http-method.constants.ts`, `http-status.constants.ts`, `http-header.constants.ts` and `media-type.constants.ts`.
The status set keeps the name `HttpStatusCode`, under the accepted code standard.
The registry loads this contract's `assets/ast-grep/rules`.
`http-method-literals-typescript` reports a method literal, and `http-status-literals-typescript` a status code under a status name, outside the declaring files and the shipped test patterns, which in Mechane match only `packages/node/testing`.
ast-grep `testing-http-method-literals` and `testing-http-status-literals` (SC-12) copy the two shipped rules for `packages/node/testing` alone, since SC-12 exempts no test code, and each entry pins its shipped rule's hash.
ast-grep `http-literal` (SC-12) reports what the shipped rules do not read: a header name and a media type.
It also reports a status code under another status-named key, such as `expectedStatus`.
So does one in a status-named object other than `HttpStatusCode`, such as a family's status table, whose values `magic-number` skips as property values.
It reports `HEAD` as a value of a method-named object too, which the shipped rule does not read, since `HEAD` also names a git ref.
It skips the three records files that declare those sets.
An error's tag stays a member of its tagged union, which `hand-written-tag` holds, so the tag-literal allowance is unused.
ast-grep `hand-written-tag` ratchets a `_tag` property type or value written by hand, which a `Schema.TaggedUnion`, or a union of `Schema.TaggedStruct`, and its constructors replace.
A closed set's schemas read its members (TD-19): ast-grep `raw-literal-schema` rejects a string, number or template literal written in `Schema.Literal` or `Schema.Literals`.

The v11 membership-lists rule is enforced, and member-chains is a ratchet whose generated baseline holds the existing sites.
The shipped oxlint prefer-set-has setting is already enabled by the repository's native categories, so that redundant asset stays unloaded.
The test-support HTTP method copy retains its prior scope: no StyleX definition occurs there, so v11's StyleX-key exemption is unnecessary.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- asset `assets/ast-grep/rules` `http-method-literals-typescript` (SC-12): a ratchet until phase F2
- asset `assets/ast-grep/rules` `http-status-literals-typescript` (SC-12): enforced in phase F2
- asset `assets/ast-grep/rules` `member-chains-typescript` (014): a ratchet until phase F2
- asset `assets/ast-grep/rules` `membership-lists-typescript` (014): enforced in phase F2
- ast-grep `testing-http-method-literals` (SC-12): enforced in phase F2
- ast-grep `testing-http-status-literals` (SC-12): enforced in phase F2
- ast-grep `hand-written-tag` (TD-20): a ratchet until phase F2
- ast-grep `literal-comparison` (TD-19): enforced
- ast-grep `raw-literal-schema` (TD-19): enforced in phase F2

<!-- End of the generated block. -->

---
name: code-module-structure-and-control-flow
message: Keep modules focused and named for their behavior, start every lowercase function name with a declared verb, and keep inputs, results, and control flow explicit.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Give each module one understandable responsibility.
Name modules for the behavior or resource they own.
Name each function, type, and file, whether exported or not, and each stored or wire value, for the behavior or concept it stands for, never with a generic word alone such as `data`, `info`, `item`, `manager`, `handler`, or `script`.
A declared file role, such as `types` or `constants`, is not a generic name for a file that holds that role.
Write a generic stored or wire name or value that another system fixes, or that a released format keeps as `data-stored-and-shipped-formats` requires, only in the mapping that reads or writes it, such as a serializer rename that decodes an order's `item` field into `lineItem` or an enumeration member `LineItem` whose value is `'item'`.
A serializer rename or an enumeration member's declared value that keeps the external name is the allowed mapping; an owned field, type, or member that carries the generic name is not.
Do not create catch-all modules, such as `helpers`, `common`, or `misc`, that mix code of unrelated concerns.
A shared utilities module that holds only domain-free functions, one per file, as `code-shared-utilities` defines, and a test support folder that holds one helper or fixture per file, as `test-support-modules` defines, are not catch-all modules.
Create a module only when it has an actual responsibility; do not add placeholder files.
Split a module when the split reduces the context needed to understand a change, and keep cohesive code together when splitting would obscure its invariants.
Keep a helper that depends on its module's domain private to that module until another caller needs it.

Extract a helper only when it names a real concept, collapses real duplication, or isolates an independent operation, never just to shorten a block.

Pass inputs and return results explicitly instead of relying on hidden side effects or ambient mutable state.
State that one object or closure owns and changes only through its own functions, such as a cache field, is not ambient state.
Name intermediate values when nested calls hide the sequence, in code that `code-typescript-call-arguments` does not govern.
Name values for what they hold.

Never write by hand the parsing, validation, or provider integration that a maintained library provides; call the library and use its types.

Declare a list of verbs, such as `read`, `create`, and `settle`, and start every owned function, method, function-typed member, and function-valued constant whose name begins in lowercase with one.
Match that first word in every case style, such as `settle` in `settleInvoice` and `settle_invoice`, and configure the repository's lint to reject any other first word.
The list also holds predicate prefixes from `code-boolean-names`, `on` for event handlers such as `onSubmit`, `use` for hooks, and per-language constructor and conversion prefixes such as `new` and `into`.
List only verbs and these prefixes, never a noun or adjective such as `total` or `pending`, and no word that `code-spelled-out-names` replaces.
The verb rule skips names that begin in capitals, such as components, names the language defines, such as constructors, and the `main` function of `code-script-entry-points`.
Name an accessor, which reads as a property or returns a field, and a test fixture for their values, and a test titled by its name for its behavior.
Keep a name that an interface or framework fixes, such as a platform's `alarm` method, and suppress its finding as `code-lint-suppressions` requires, with a reason naming that system.
This contract's `assets/` folder ships a default verb list and lint rules that hold it, and a repository may add or remove verbs in its copy.

Violation: `function total({ invoice }: TotalInput)` and `const finishedResults: ReadResults = ({ run }) => ...` name functions for the values they return.
Allowed: `computeTotal({ invoice })`, `readFinishedResults({ run })`, `isPaid({ invoice })`, `onSubmit`, `useInvoices`, an `InvoiceRow` component, and an accessor `get total()`.

## Checks

Read a representative changed call from entry to result: can its inputs, effects, result, error path, and owner be understood without following a chain of forwarding helpers?
Compare that call before and after the change and confirm the caller needs no more local context than before.
For each new module or helper, name the behavior it owns and the concept, duplication, or independent operation that justifies it.
Search changed paths for catch-all module names, generic names, and helpers with a single caller.
Run the repository's lint on changed files, confirm it reports no function off the verb list, and compare each language's rule and each predicate prefix with the list.
For each generic stored or wire name or value that another system or a released format fixes, does it appear only in the mapping that reads or writes it, while owned code uses a name for its concept?
Run the repository's formatter, linter, and type checks; they establish layout and types, not readability.

## Local adaptations

oxlint `id-denylist` rejects the generic names of `deniedIdentifiers`.
Effect is the maintained library for validation, through Schema, and for failures, resources and concurrency.
oxlint `max-params` allows at most `functionParameters` parameters, a backstop for a library's callback, since ast-grep `object-arguments` gives an owned function one.
oxlint `typescript/strict-boolean-expressions`, with every `allow*` option false, rejects a truthiness test, so a condition compares with the value it means.
oxlint `typescript/no-unnecessary-condition` rejects a condition the types already decide, such as `node.regex !== undefined` on a field that is never absent, with constant loop conditions allowed only as literals. It is a nursery rule, so its entry carries a violation and an allowed example, which the checks run it over with type information on every run (TD-08, TS-05).
oxlint `no-use-before-define` rejects a class read before its declaration, and lets an exported function's private helpers follow it.
ast-grep `pass-through-function` (ST-28) rejects a named function whose body only forwards its parameters to one call, such as `isGlobMatch({ file, pattern })` returning `matchesGlob(file, pattern)`, so the call replaces it; a store's forwarder that binds its client, such as `({ sql, ...input })`, adds a value and stays, and so does a typed callback const that passes a value it closes over, such as `(pattern) => matchesGlob(path, pattern)`, since only the nearest function's parameters count as forwarded.
Deviation (ST-28, under the accepted strict code standard): a private helper with one caller and two or more statements is allowed when a length limit forces it, since such a split of sequential code adds a step rather than a forwarder; review judges whether it names a concept. For such a split this replaces "never just to shorten a block".
The standard's `owned:helpers` check, which would flag a private helper of one statement and no branch with one reference in its file, is not built, so review holds that half of ST-28 until phase G builds it; a rough scan finds about 150 such helpers today. Under contract 111's amendment of ST-28 (SC-02), a typed callback const passed by name and an SC-10 builder are no such helper, so the check counts only the functions its file calls.
The router's `admit` keeps its one suppression: its type parameter binds the operation's own access, which the router's inlined call widens to its constraint, so the compiler refuses the inlined form.
oxlint `new-cap` with `capIsNew` off rejects `new` on a name that starts in lower case, such as `new plantCap()`, while a capitalized function such as `Schema.Struct` is called without `new`; 029's `externalNames` keeps its name and option out of the banned words.
oxlint `no-bitwise` rejects a bitwise operator but three suppressed masks: the deploy program and the smoke's private-file check read a file mode's access bits, and the guest finds a UTF-8 continuation byte.
oxlint `unicorn/no-array-callback-reference` is off by decision under contract 111's SC-03: a typed callback const states the parameters it reads, and TD-01 gives an owned function no second positional parameter.
Time is read only with `DateTime.nowUnsafe()` (EF-17): ast-grep `date-constructor` rejects `new Date`. A function repeats with a loop (EF-18): ast-grep `loop-recursion` ratchets a function that calls itself by name, which the sweep turns into a worklist loop or, for a walk of recursive data, suppresses by name; it does not see two functions that call each other.
Contract 064 governs every TypeScript file, so its bound statements take the place of "Name intermediate values when nested calls hide the sequence", and its `nested-call` ratchet holds them.

Deviation (SC-02, amending ST-28 and the standard's §3.0 #46): a typed callback const passed by name and an SC-10 builder are no one-statement helper, even with one caller.
For them this replaces "Extract a helper only when it names a real concept, collapses real duplication, or isolates an independent operation, never just to shorten a block".

A name another system fixes, or that a shipped format keeps, appears only in the mapping that reads or writes it.
`renamedWireStruct` and `PAGE_RENAMES` map a `/v1` key that `wireKey` cannot derive, and a closed-set member's value holds a header's name, such as `HttpHeader.XSessionId`'s `'x-session-id'`.
A store's SQL text stays in its records function, and an outbound request has its own mapping, such as `endUserPayload`, which writes the workspace's `endUserId` as OpenRouter's `user`.
Owned fields and members keep their concept's name, and `id-denylist` rejects a generic one.

The v11 verb-list additions are staged outside the current adoption baseline at commit 94f2d0f.
The shipped naming rules stay unloaded until their registry rollout establishes a shrinking baseline and handles runtime-fixed names.
The existing glossary, banned words and helper rules continue to govern names.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `deniedIdentifiers` `common`, `data`, `endpoint`, `handler`, `helpers`, `info`, `item`, `manager`, `misc`, `script`; `functionParameters` 3.
- oxlint `id-denylist` (NM-06): enforced, `["error","common","data","endpoint","handler","helpers","info","item","manager","misc","script"]`
- oxlint `typescript/strict-boolean-expressions` (TD-08): enforced in phase A, `["error",{"allowString":false,"allowNumber":false,"allowNullableObject":false,"allowNullableBoolean":false,"allowNullableString":false,"allowNullableNumber":false,"allowNullableEnum":false,"allowAny":false}]`
- oxlint `typescript/no-unnecessary-condition` (TD-08): enforced in phase D, `["error",{"allowConstantLoopConditions":"only-allowed-literals"}]`
- oxlint `max-params` (ST-25): enforced in phase A, `["error",{"max":3}]`
- ast-grep `pass-through-function` (ST-28): enforced in phase D
- ast-grep `loop-recursion` (EF-18): a ratchet until phase F3
- oxlint `no-use-before-define` (ST-29): enforced in phase A, `["error",{"functions":false,"classes":true,"variables":false,"typedefs":false,"ignoreTypeReferences":true}]`
- oxlint `new-cap` (007): enforced in phase D, `["error",{"capIsNew":false}]`
- oxlint `no-bitwise` (007): enforced in phase D, `"error"`
- oxlint's restricted members (EF-17): enforced in phase F5: `Date.now`, `DateTime.now`, `Clock` of `effect`
- ast-grep `date-constructor` (EF-17): enforced in phase F5

<!-- End of the generated block. -->

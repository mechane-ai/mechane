---
name: code-typescript-call-arguments
message: Bind to a name each nested call, `new`, `await`, and function written in an argument object or array, and each awaited or `yield*` value before reading a member.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Never write a call, a `new` expression, or an `await` inside the arguments of another call or `new` expression; bind its result to a name and pass the name.
This holds through every expression in the arguments, such as an object field, an array element, a template, an operator, a spread, or a type assertion.
A call chain such as `invoices.listForAccount({ account }).findLatest()` is one call, and the calls on its receiver side are not arguments.
Inside a function, class, or embedded markup element written in the arguments, the rule starts afresh, so `orders.map((order) => computeTotal({ order }))` is allowed.
A tagged template is a template, not a call: passing one is allowed, and a call in its placeholders counts as inside the arguments that hold it.

A file with the schema role the repository declares under `code-module-file-roles` may nest calls, `new` expressions, and `await` inside arguments, such as `Schema.Struct({ tags: Schema.Array(Schema.String) })`.
The configuration under `assets/` exempts files named `schemas`, the name the example in `code-module-file-roles` gives that role.
A repository that declares another schema file name copies that configuration into its own lint configuration with the name it declares.

Each direct argument of `pipe(...)` or of a `.pipe(...)` method may itself be one call, such as `amount.pipe(map((price) => applyDiscount({ price })), tap((price) => recordPrice({ price })))`, but never a `new` expression or an `await`.
The arguments of such a step follow the rules above, so `pipe(succeed(readAmount({ id })), map((price) => applyDiscount({ price })))` violates them.
When a step needs an earlier step's result other than its input, or chooses between paths, bind each step's result in a statement, such as `const amount = yield* readAmount({ id })`.
Leave a pipeline's line layout to the repository's formatter.

Bind the value of an `await` or `yield*` expression to a name before reading its members, such as `const invoice = await readInvoice({ id })`, then `invoice.status`.
Calling a method and indexing read a member too, and the rule holds through parentheses and type or non-null assertions, such as `((await read()) as Reply).result`.
Destructuring the value in the declaration that binds it, such as `const { status } = await readInvoice({ id })`, counts as binding it.

Bind to a name each function written as a field, method, or element of an object or array in the arguments of a call or `new` expression.
Objects and arrays nested inside one another count at any depth, but a function, class, call, or embedded markup element in between starts afresh.
A getter or setter is an accessor, not a function field, and stays where it is written.
A function passed directly as an argument stays inline, such as `orders.map((order) => order.id)` or `memoize(() => computeTotal({ lines }), [lines])`.
Bind each such function as `code-typescript-const-bindings` requires, such as `const writeEvent: EventSink = ...`.
A function bound to meet these rules is an independent operation under `code-module-structure-and-control-flow`, even when the call that receives it is its only use.

Configure the repository's lint to enforce these rules wherever a tool supports them, and suppress a finding only as `code-lint-suppressions` allows.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.

Violation: `send({ invoice: await readInvoice({ id }) })` nests an `await` and a call inside an argument.
Violation: `prepare({ onEvent: ({ event }) => log({ event }) })` writes a function as a field of an argument object.
Allowed: `const invoice = await readInvoice({ id })`, then `send({ invoice })`, and `prepare({ onEvent: writeEvent })` after `const writeEvent: EventSink = ({ event }) => log({ event })`.
Violation: `const status = (await readInvoice({ id })).status` and `(yield* readOrder({ id })).total` read a member of a value that no name holds.
Allowed: `const order = yield* readOrder({ id })`, then `order.total`, or `const { total } = yield* readOrder({ id })`.

## Checks

Run the repository's lint from the repository root and confirm that it rejects a nested call, a function in an argument object, and a member read from an `await`.
For each call a change adds or edits, does an argument hold a call, `new`, or `await` that is neither a direct pipeline step nor in a schema file?
For each pipeline a change adds, does a step need an earlier step's result other than its input, or choose between paths, without bound statements?
For each object or array a change passes to a call, is every function written in it bound to a name?
For each member a change reads from an `await` or `yield*` expression, through parentheses or assertions, is the value bound to a name first?

## Local adaptations

An entity brand's `make` may directly wrap `randomUUID()` or `crypto.randomUUID()`. Contract 044 requires this immediate
branding; other nested calls remain subject to this contract.

oxlint `func-style` comes from contract 015's shipped oxlint file, which the registry extends. `declaration` with `allowTypeAnnotation` writes each named function as a `function` declaration. An `Effect.fn` stays a constant, since the rule passes over a call, and so does a typed callback const, which SC-03 asks for.
ast-grep `nested-call` copies the shipped `call-arguments-typescript` rule, as this contract allows for another schema role, and exempts Mechane's schema role. That role is the `schemas.ts` and `<concept>.schemas.ts` files and a schema declaration in any file: a constant whose value is a `Schema.*`, `wireStruct` or `renamedWireStruct` call, and the class that declares a tagged error. It is a ratchet at its baseline, so new code binds every nested call first. Its registry entry pins the installed rule's hash in `derivedFrom`, so `rules:check` fails when an update changes the shipped rule until the copy is reviewed.
Deviation (ST-19): a schema declaration may nest calls wherever ST-19 puts it, since ST-19 declares a schema that one file uses in that file. This replaces "A file with the schema role the repository declares under `code-module-file-roles` may nest calls, `new` expressions, and `await` inside arguments" with the declaration in place of the file.
Deviation (SC-02's E6 and E8, under the accepted code standard in contract 111): E6's `catch`, which builds one tagged error with `String(cause)` as its only call, keeps that nested call. So does E8's trailing catch at an entry boundary, `Effect.catch((failure) => …)` or `(run, input) => Effect.catch(run, (failure) => …)`, whose arrows hold calls alone, and `nested-call` exempts both shapes. This replaces "Never write a call, a `new` expression, or an `await` inside the arguments of another call or `new` expression" for those forms.
Deviation (SC-02, under the accepted code standard in contract 111): the inline forms SC-02 allows stay inline as fields of an argument object. These are E6's `try` and `catch` of `Effect.tryPromise` and `Effect.try`, E7's register function, E8's boundary arrow, E2 projections, E3 adapters, and the handler objects of `Effect.catchTags`, `Match.valueTags`, `Option.match` and `Result.match` built of them. Any other function in an argument object is a typed callback const, as SC-02 and SC-03 require, which ast-grep `inline-function-argument` holds. This replaces "Bind to a name each function written as a field, method, or element of an object or array in the arguments of a call or `new` expression" for those forms. The shipped `argument-object-functions` rules are not loaded.

The registry loads the shipped no-await-expression-member setting, and review checks the corresponding yield* member reads.
The nested-call copy was reviewed against v11; only the upstream explanation changed, so its schema and SC-02 exceptions are preserved.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- asset `assets/oxlint/oxlintrc.json` `unicorn/no-await-expression-member` (064): enforced in phase D, `"error"`
- ast-grep `nested-call` (064): a ratchet until phase F3

<!-- End of the generated block. -->

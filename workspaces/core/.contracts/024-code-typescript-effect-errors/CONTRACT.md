---
name: code-typescript-effect-errors
message: Carry each TypeScript failure that a caller can act on as a tagged error in an Effect's error type, and every other failure as a tagged defect.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Treat a failure as expected when any caller or user could act differently because of it, such as a requested record that does not exist or a dropped request.
Treat every other failure as a defect, such as a record that the same object wrote now missing or corrupt, which means the code's own invariant broke.
An empty result, such as a search that matches nothing, is a value, but a lookup that finds no record for a caller's identifier is an expected failure.

Fail with a tagged error class for each expected failure, such as `class InvoiceNotFound extends Schema.TaggedErrorClass<InvoiceNotFound>()('InvoiceNotFound', { invoice: Schema.String }) {}`, and treat its tag as the failure's stable code.
Use `Effect.die`, `Effect.orDie`, or `throw` only for a defect, and give it a tagged error class with fields that locate it, such as `new InvoiceMissing({ invoice })`.
Give each tagged error the fields its handler needs, such as the invoice number or the provider's status, never only a message string.
Give each failure that a handler treats differently its own tag; a field may refine a tag only with a member of a closed set, such as a provider's refusal kind, never with a free-form code string.
Never build or extend a bare runtime error, such as `new Error(message)` or `class InvoiceError extends Error`, and never fail, die, or throw with a string or plain object.
A test fake that stands in for a dependency may throw what that dependency throws, such as the `TypeError` of a failed network request.

Pass an expected failure up in the error type, unchanged or wrapped in a higher-level tagged error, until the code that decides what happens next handles it by tag, such as with `Effect.catchTag`.
Never return `null`, `undefined`, `false`, or an `{ ok: false }` object for an expected failure, and never discard one, such as with `Effect.ignore`, `Effect.option`, or `Effect.orElseSucceed`.
A handler that catches every failure at once, such as `Effect.catch`, is allowed when it branches on each tag, such as by passing the error to a function that switches on its `_tag` with a case for every tag.

Wrap each foreign call that can throw or reject, such as `fetch`, JSON parsing, or a storage or library call, once where it is called, with `Effect.tryPromise` or `Effect.try`.
Map its failure in the `catch` option to a tagged error class that keeps the caught value as its `cause`, such as `RequestDropped` for a failed `fetch`.
Never write a `catch` clause or call a promise's `then`, `catch`, or `finally` method, though a `try` with only a `finally` clause may release a resource.
Declare every function that returns a promise `async`, even one without `await`, write `return await` for each promise it returns, and discard a promise only with `void`.

Run an Effect, such as with `Effect.runPromise`, only at an entry point that a framework or runtime calls, such as a request or click handler.
Map each tag to that entry point's response there, such as a 404 response for `InvoiceNotFound` or a retry prompt for a dropped request.
Elsewhere, compose Effects with `pipe` as `code-typescript-call-arguments` allows, and write the bound statements that it requires inside `Effect.gen`, such as `const invoice = yield* readInvoice({ id })`.
Give each entry point one defect handler that records the defect and ends its unit of work, such as a server's 500 response or a command's error exit status.
Wrap each route of a user interface in an error boundary, and pass it the defects of that route's event handlers and asynchronous reads, which it cannot catch itself.
Catch a defect only in an entry point's defect handler, and never log a failure or defect and then continue, whether in a component or anywhere else.

Configure the repository's lint to reject bare runtime errors, thrown literals, `catch` clauses, inline `catch` handlers, and the other promise forms above, suppressing a finding only as `code-lint-suppressions` allows.
Keep off any lint rule that reports a tagged error class's declaration, such as one requiring `new` before each call whose name ends in `Error`.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.

Violation: `if (!response.ok) { throw new Error('the payment provider refused the refund'); }` turns a provider refusal into an untyped exception.
Violation: `Effect.orDie(refunding)` after `const refunding = refund({ invoice })` turns the provider's refusals and outages into defects.
Violation: `readInvoice({ invoice })` throws `new Error('invoice row missing')` for a row that the same object wrote, so the defect carries neither a tag nor the invoice number.
Violation: a component calls `readInvoice({ id }).catch(() => {})`, so a dropped request shows no retry and a defect never reaches the route's error boundary.
Violation: `function readInvoice(signal: Readonly<AbortSignal>) { return fetch(INVOICE_URL, { signal }).then((response) => response.json()) }` chains the promise with `then` and returns it from a function that is not `async`.
Violation: a click handler calls `save({ invoice })` as a statement, so the promise is discarded without `void`.
Allowed: `return yield* new RefundRefused({ invoice, status })`, which the request handler handles with `Effect.catchTag('RefundRefused', ...)`.
Allowed: `throw new InvoiceMissing({ invoice })` inside `Effect.gen` for a row that the same object wrote, and `return yield* new InvoiceNotFound({ invoice })` for a number a caller supplied.
Allowed: `async function readInvoice(signal: Readonly<AbortSignal>): Promise<unknown> { const response = await fetch(INVOICE_URL, { signal }); return await response.json() }`, which `Effect.tryPromise({ catch: buildRequestDropped, try: readInvoice })` calls.

## Checks

Run the type check from each package root; an Effect's error type lists every tag it can fail with.
Run the repository's lint with type information from the repository root, and confirm that it reports no type configuration error and rejects each form the lint rule names.
For each failure a change adds, could any caller or user act differently because of it, and is it a tagged error if so and a tagged defect otherwise?
For each tagged error a change adds, which code handles it by tag, and does every Effect between them pass it up in its error type?
For each `Effect.ignore`, `Effect.option`, `Effect.orElseSucceed`, or catch-all handler a change adds, does it discard an expected failure or skip a tag?
For each foreign call a change adds, is it wrapped once where it is called, with its failure mapped to a tagged class that keeps the cause?
For each entry point a change adds, where is its one defect handler, and does the change run an Effect or catch a defect anywhere else?

## Local adaptations

Entry points that run an Effect: the Worker's `fetch` in `packages/worker/app/src/worker.ts` and the `main` of each executable, every `main.ts`, enforced by ast-grep `effect-run-at-entry`.
ast-grep `tagged-error-cause` rejects a tagged error field named `cause`, which collides with `Error.cause`; such a field is named `reason`.
ast-grep `no-ok-false` rejects an `{ ok: false }` object.
A Durable Object runs no Effect: it decodes another object's answer, the host launcher's and its settings with `Schema.decodeUnknownSync` or a `Result` it throws from, which fails as a defect, as a broken invariant does.
pi-ai's provider boundary takes only a rejected promise, so a dispatch the allowance refused rejects with the tagged `AllowanceExhausted`, after its turn records the refusal.
A defect sits only where ER-06 allows one: ast-grep `defect-sites` ratchets `Schema.decodeUnknownSync`, `Option.getOrThrow`, `Effect.orDie`, `Effect.die` and `Effect.dieMessage` outside an object's RPC method, the store kernel's decode verbs, a `getOrThrow` after `Option.fromNullishOr`, and an `orDie` inside `acquireRelease`'s release; its baseline holds every other defect, each with its invariant stated in a comment above it, in place of ER-06's named suppression, since AS-02 caps a rule's suppressions at three; the sites without one are RPC answers DO-04's catalogs decode and dependencies' answers TD-22 makes typed failures.
`defect-sites` does not read a plain-dialect `Result.getOrThrow`, since a widened rule would raise its baseline over the merge base's, so review holds each one.
The sandbox's claim throws `ExecutionReused` that way and its host launcher's calls `LauncherRefused`, which names the machine's URL, while pi-ai's setup rejects with `AllowanceExhausted`.
Deviation (ER-06): a defect at one of ER-06's library sites, `decodeUnknownSync` at an RPC input or in a store's row decode and `Option.getOrThrow` on a value the types exclude, carries the error its library throws. Every other defect, `Effect.die`, `Effect.orDie` and a plain-dialect `Result.getOrThrow` included, carries an owned tagged error or the tagged failure it promotes. This replaces the defect's tagged error "with fields that locate it" for those sites.
Each `Effect.orDie` dies at a release or an encode. A scope's release has no failure channel, so one that removes a path or closes a handle the program owns dies when `rm` with `force` or the close refuses, and the smoke's restore of the stack's variables dies when its restart fails. A release whose effect is bound before its scope opens dies in `acquireRelease` itself, such as `() => Effect.orDie(removal)`, which `defect-sites` allows. One that needs the acquired value, such as celld's log handle, dies in its own function, whose error names the path, and the baseline holds it.
Encoding output that the same code built to its schema's type, and decoding a row that only its store wrote, fail as defects with `Effect.orDie`, because a failure there is a broken invariant.
A known execution id that arrives with another request is a defect, since only pi's replay repeats an id, with the arguments it recorded. `claimExecution` answers the tagged `ExecutionReused`, which names the `executionId`, from its transaction. `runExecution` dies with it through `Result.getOrThrow`, so the sandbox's RPC call rejects as 041's refusal of a reused identity. The failure joins no RPC union and no `/v1` answer.
oxlint `no-restricted-properties` rejects `Effect.ignore`, `option`, `result`, `either`, `orElse`, `orElseSucceed`, `orElseFail` and `catchCause`, which discard a failure, so a caller handles each expected failure by its tag.
Handling by tag takes the object form of `Effect.catchTags` even for one tag, such as `Effect.catchTags({ RefundRefused: … })`, where the rules name `Effect.catchTag` (ER-07): ast-grep `catch-tags` rejects `Effect.catchTag` with one tag, and `mise run fix` writes its object form, and oxlint `no-restricted-properties` rejects `Effect.catchTag`, `catchIf`, `catchFilter`, `catchSome` and `match`.
A catch-all handler appears only at an entry boundary (ER-08): ast-grep `catch-all-outside-boundary` rejects an `Effect.catch` anywhere but as a trailing argument of the `Effect.fn` of `serve`, `servePage` or `runCommand`, `Effect.catch((failure) => …)`, or `(run, input) => Effect.catch(run, (failure) => …)` where the answer reads the call's input, and each answer branches on every tag through its message table.
A program's one failure, such as `DistributionFailed`, `ReleaseFailed` or `StackFailed`, names its failed step and its `subjects`. Subjects use `@mechane/program`'s `StepSubject` union instead of free-form operation text. The program's message table formats them with `stepLine`.
ast-grep `error-free-text` ratchets a tagged error's fields to ids, closed-set members, measured values and at most one `reason`, a dependency's own text: it rejects a field named `message`, `issue`, `detail`, `code` or `operation`, and a URL or a timeout held as `Schema.String`.
An effectful function is an `Effect.fn`: ast-grep `effect-function-form` ratchets a function or method whose return type is `Effect.Effect`, and oxlint `no-restricted-properties` ratchets `Effect.gen` and `fnUntraced`. ast-grep `effect-fn-return-type` rejects an `Effect.fn` generator without an `Effect.fn.Return` type, and the owned `span-name` check one whose span name is missing or differs from the binding or property that holds it.
A generator binds each value with `yield*`: oxlint `no-restricted-properties` ratchets `Effect.map`, `flatMap`, `andThen`, `tap`, `as`, `asVoid`, `asSome`, `zip`, `zipWith`, `suspend`, `flatten` and `filterOrFail`, and ast-grep `effect-import-form` rejects importing `effect` under an alias, as a namespace or from a subpath other than `effect/encoding`, any of which would dodge a ban of a property.
A wrap of a promise or of a throwing call holds one call: ast-grep `try-promise-shape` ratchets an `Effect.tryPromise` or `Effect.try` whose `try` is not an arrow whose body is one call or whose `catch` builds no tagged error, and a call of an `attempt` helper, which `program` no longer has since each caller wraps its own promise, and oxlint `no-restricted-properties` ratchets `Effect.promise`.
A failure is told apart by its tag (EF-05): ast-grep `no-instanceof` rejects `instanceof`, which a decoded value or another realm's object fails.
The registry loads both files this contract ships under `assets/`.
It extends `assets/oxlint/oxlintrc.json`, which turns on `no-throw-literal` and `preserve-caught-error` and keeps `unicorn/throw-new-error` off.
It adds `assets/ast-grep/rules`, whose `untagged-errors-typescript` and `catch-handlers-typescript` are enforced.
Mechane's own rules hold what the shipped ones do not: ast-grep `no-throw-or-try` rejects every `throw` and every `try`, one with only a `finally` clause included, since SC-09 bans both.
`untyped-failure` (SC-09) rejects `Option.getOrThrowWith`, `Result.getOrThrowWith`, `Promise.reject` and a text step field.
`promise-chain` (DO-03) rejects a promise's `catch` with a named handler, `finally`, `Promise.resolve`, `new Promise` and a chained `then`.
The bound statements that `code-typescript-call-arguments` requires go inside an `Effect.fn` generator, the traced form of `Effect.gen` that EF-01 requires.

Deviation (ER-01, ER-02, ER-09): a wrap's `catch` builds a tagged error whose `reason` holds the caught value's text, `String(cause)`.
It never keeps the caught value, which ast-grep `tagged-error-cause` rejects as a field.
An error's fields travel on `/v1` (ER-09), in the CLI's JSON envelope and in log lines, and a caught value is unbounded and may hold a request's headers.
This replaces the `catch` option's mapping "that keeps the caught value as its `cause`" and the check's "that keeps the cause".

Each entry point has one defect handler.
A `main.ts` maps its `Exit` in `reportExit`, which writes the defect's trace through the program's output module and answers the program's failure status.
The Worker's `fetch` leaves a defect to the Workers runtime, which answers 500 and records the exception in the Worker's log.

A Durable Object's alarm and RPC methods also leave a defect to the runtime, which retries an alarm and rejects an RPC call.
The Worker's `callObject` maps that rejection to `ObjectUnavailable`.
Pages are server-rendered HTML with no client script, so no route has an error boundary.

The registry loads all TypeScript ast-grep rules from this contract, with promise-chains held by its generated ratchet baseline.
Deviation (EF-06, DO-03): direct native-promise callbacks at the Effect boundary keep their existing signatures and return forms.
This replaces v11's blanket async and return-await requirements where the existing async-shell rules exempt those callbacks.
The oxlint asset stays unloaded because it would override those rules; owned no-throw-literal, preserve-caught-error and throw-new-error settings retain their prior values.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `no-throw-literal` (ER-04): enforced in phase F3, `"error"`
- oxlint `preserve-caught-error` (ER-04): enforced in phase F3, `"error"`
- oxlint `unicorn/throw-new-error` (ER-04): enforced in phase F3, `"off"`
- asset `assets/ast-grep/rules` `untagged-errors-typescript` (ER-04): enforced in phase F3
- asset `assets/ast-grep/rules` `catch-handlers-typescript` (ER-04): enforced in phase F3
- asset `assets/ast-grep/rules` `promise-chains-typescript` (ER-04): a ratchet until phase F3
- oxlint's restricted members (ER-05): enforced in phase A: `Effect.ignore`, `Effect.option`, `Effect.result`, `Effect.either`, `Effect.orElse`, `Effect.orElseSucceed`, `Effect.orElseFail`, `Effect.catchCause`
- oxlint's restricted members (ER-06): enforced in phase F3: `Option.getOrThrowWith`
- ast-grep `defect-sites` (ER-06): a ratchet until phase F3
- ast-grep `catch-tags` (ER-07): enforced in phase D
- oxlint's restricted members (ER-07): enforced in phase D: `Effect.catchTag`, `Effect.catchIf`, `Effect.catchFilter`, `Effect.catchSome`, `Effect.match`
- ast-grep `catch-all-outside-boundary` (ER-08): enforced in phase F3
- ast-grep `no-instanceof` (EF-05): enforced in phase F3
- oxlint's restricted members (EF-01): a ratchet until phase F3: `Effect.gen`, `Effect.fnUntraced`
- oxlint's restricted members (EF-02): a ratchet until phase F3: `Effect.map`, `Effect.flatMap`, `Effect.andThen`, `Effect.tap`, `Effect.as`, `Effect.asVoid`, `Effect.asSome`, `Effect.zip`, `Effect.zipWith`, `Effect.suspend`, `Effect.flatten`
- oxlint's restricted members (EF-02): a ratchet until phase F3: `Effect.filterOrFail`
- owned check `span-name` (EF-01): enforced in phase C1
- ast-grep `effect-fn-return-type` (EF-01): enforced in phase C1
- ast-grep `effect-function-form` (EF-01): a ratchet until phase F3
- ast-grep `effect-import-form` (EF-02): enforced in phase C1
- ast-grep `effect-run-at-entry` (EF-12): enforced
- ast-grep `error-free-text` (ER-02): a ratchet until phase F2
- ast-grep `no-ok-false` (ER-04): enforced
- ast-grep `no-throw-or-try` (ER-04): enforced
- ast-grep `tagged-error-cause` (ER-01): enforced
- ast-grep `try-promise-shape` (EF-06): a ratchet until phase F3

<!-- End of the generated block. -->

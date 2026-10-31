---
name: code-style
message: Choose a value with statements, pass a function by name, keep related private helpers with their operation, and build every path, number and HTTP word from its named form.
paths: ["**/*.ts"]
---

## Rules

These rules hold every line of Mechane's TypeScript a change writes, on top of the strict standard; code a change only moves keeps its findings until a sweep reaches it.
Each rule has an id from SC-01 to SC-12, which every message of its checks ends with.

**SC-01, choose a value with statements.**
No conditional operator stands in a value expression, nested or not.
Choose a value by what the condition tests: a `_tag` union with `Match.valueTags` naming every tag; a named-member set with a function whose last statement is a `switch` naming every member and no `default`; a member mapped to a constant with a `Record<Set, Value>` table; an `Option` with `Option.getOrElse`, or `Option.match` when both arms give the value.
Choose anything else in an IIFE that is a typed const's value: `const wait: Duration.Duration = (() => { if (isFollowing) { return WAIT_MAX; } return LISTING_WAIT; })();`.
The IIFE takes no parameters, is never `async`, and holds only guards, `const` bindings and one final return, with no loop, `let`, `await` or `yield`; an effectful choice is an `Effect.fn` that returns the value.
An IIFE never sits in a `case` or `Match` arm; the choice becomes a named function there, when two functions make the same choice, or when inlining it would take its caller past `functionLines`.
Never fill a `let` in branches, choose a value with `&&`, `||` or `??`.
A conditional type, `T extends U ? X : Y`, has no statement form, so it stays where ST-19 places it.
Contracts 012 and 015 record SC-01's IIFE as a deviation.

**SC-02, pass a function by name.**
A function passed as an argument or held by an object literal is inline only in one of eight forms; any other is a typed callback const declared above the statement that passes it, with no statement between.
E1 is the generator of `Effect.fn('name')(function* …)` that is a const's value, never one passed straight to another call.
E2 is a projection: an expression-bodied arrow whose body holds no call, `new`, template, function, conditional, `await` or `yield`, such as `(mech) => mech.id`.
E3 is an adapter: an expression-bodied arrow whose body is one call or `new`, awaited in an `async` arrow, whose callee and arguments hold none of those, such as `(part) => readText({ part })`.
E4 is an expression-bodied arrow passed straight to a `Schema.*`, `SchemaGetter.*` or `SchemaTransformation.*` call.
E5 is a value of a typed module-level table, such as `const KEY_MESSAGES: Readonly<FailureMessages<…>> = { … }`.
E6 is the `try` and `catch` arrows of `Effect.tryPromise` and `Effect.try`, `catch` building one tagged error from `cause` with `String(cause)` as its only call, and `try` calling with arguments bound to consts first.
E7 is the register function of `Effect.callback`; a listener inside it that is not a projection or an adapter is a typed const above the registration, with no statement between.
E8 is ER-08's catch as a trailing argument of an `Effect.fn`: the arrow of `Effect.catch((failure) => …)`, or, where the answer reads the call's input, `(run, input) => Effect.catch(run, (failure) => …)` with its arrow, each holding calls alone and no function, template, conditional, `await` or `yield` beyond the inner arrow, such as `(failure) => Effect.succeed(respondFailure({ failure, message: failureMessage({ failure }) }))`.
The shape decides, never the line count; a pipe step is a call whose function follows E2 and E3, and `Effect.map`, `flatMap` and `tap` become `yield*` statements first.
A typed callback const passed by name, and an SC-10 builder, is no helper under ST-28's one-statement test, so `owned:helpers` counts only the functions its file calls.
As fields of an argument object these forms stay inline too, and E6 and E8 keep the nested calls they hold, under contract 064's deviations.

**SC-03, give a named function the form its caller needs.**
A module-level function that owned code calls by name takes one destructured object: a `function` declaration in the plain dialect, an `Effect.fn` const in the effect dialect.
A function passed as a value is a typed callback const, `const name: (param: ParamType) => ReturnType = (param) => …`, whose callee fixes its positional signature; type it with an owned named type or an indexed member, such as `MachineProvider['stop']`, or with an explicit function type, never `Parameters<…>` of a library function.
A named callback is a typed const above the statement that passes it, with no statement between, even when it reads no local binding.
Inside a function body every named function is a typed const declared above the statement that first uses it, with no statement between, a port factory's methods included; never an untyped const arrow, a function expression, or a function declaration inside another function.
A function both called and passed takes one object and is passed through an adapter, such as `(item) => isOverLimit({ item })`; effectful work behind a callback is an `Effect.fn` with an object input, reached through an adapter.

**SC-04, one exported operation with its private helpers.**
A behavior file exports one operation, named for its file stem.
Keep private helpers that explain that operation beside it, including helpers called by other private helpers in the same operation.
Extract a separate module for an independent concept or real reuse, rather than to meet a function-count quota.
Each helper must name a meaningful step; inline trivial forwarding glue.
The existing function-length, complexity, and file-length bounds still apply.
Review whether the operation's ordering, state changes, and failure paths can be followed in this file.

**SC-05, split beside the file, and group a feature into a folder when the folder fills.**
A split's files stay in the folder of the file they came from, within `folderFiles` and `folderDepth`.
When a file would push a folder past its width, first move the files that serve one feature into a child folder named for the feature's `/v1` resource noun or the glossary noun its exports share, never `helpers`, `utils`, `common`, `misc`, `handle`, `stubs` or `shared`.
A child folder is legal at level 1 below `src`, or at level 2 when its parent holds only folders; otherwise the folder needs a package split and the file stays whole.
Never name a file after a sibling folder, never split or move a path the move map names by path, and give no folder an `index.ts`.

**SC-06, `index.ts` is only a package's public API.**
Each library package has exactly one `src/index.ts`, its exports map's only entry, holding only named re-exports of what another package imports.
A file imports the declaring file of its own package by path, never its package's index, and no folder has an `index.ts`.
No namespace re-export, `export * as X`, and no namespace import, `import * as X`.

**SC-07, roll functions into a package only at a boundary.**
A concept folder becomes its own package only for an ST-01 criterion: `state`, `closure`, `reuse` or `program`.
Otherwise it stays a folder until its package passes ST-17's budgets, and then the package splits along its README's split seam.
The package is the class Mechane writes: its `index.ts` is its public surface and its files are its methods; no owned class exists besides Durable Objects and tagged errors.

**SC-08, rewrite dense code as named steps or a stream.**
A loop body holds no loop of the same function, a loop states its end in its condition, so no `while (true)` or `for (;;)`, and nothing is updated in place: no `x++`, `x--`, `x += …`, `x -= …` or `x = x + …`.
A sum adds a mapped array bound first, such as `const sizes = Array.map(items, size);` and `const total = Number.sumAll(sizes);`, a count is a filter's length, and a bound reached part-way is a named step that returns how far it got.
A `let` is a loop's carried value, reassigned only to a named step's result, such as `next = await copyTablePage({ … })`.
No `push`, `unshift`, `add` or `set` fills a collection inside a loop; build an array with `Array.map`, `Array.flatMap` over `Option.toArray`, or `Array.getSomes`, and a `Map`, `Set`, `Headers` or `URLSearchParams` from such an array with its constructor.
The one collection a loop changes in place is the state a closure keeps across its calls: a `Map` or `Set` that a factory declares at its top and never returns, filled by a closure the factory declares beside it and answers in its object, such as a cache's `Map`.
A `for … of` that runs each step in order with `yield*` or `await` stays a loop; an effect-dialect cursor read is one `Stream.paginate(start, step)`, written as data-first calls bound to consts, while the plain dialect pages with a loop over named steps.

**SC-09, fail only with tagged errors.**
Contract 024 decides failures: tagged error classes, one wrap per foreign call, no bare runtime error, no `catch`.
In the effect dialect the error travels in `Effect.fn.Return<A, E>` and leaves a generator by `return yield* new X({ … })`, a dependency's promise wrapped once by `Effect.tryPromise` in E6's shape.
In the plain dialect a function that can fail answers `Result.Result<A, X>` and fails with `Result.fail(new X({ … }))`, and its caller guards with `Result.isFailure`.
Fields name what failed: branded ids, closed-set members such as a `step`, the path or URL, measured values, and at most one `reason` holding a dependency's own text.
Never `throw`, `try`, `Option.getOrThrowWith`, `Result.getOrThrowWith`, `Promise.reject`, or a text value for `operation`, `step`, `issue`, `code`, `message` or `detail`; a broken invariant dies only at ER-06's sites.

**SC-10, build every path, URL, query and key in a named builder.**
A string that a program or another system parses is the return value of one builder named for what it returns, ending in `Path`, `Url`, `Query`, `Key`, `Name`, `Ref`, `Glob`, `Specifier`, `Header`, `Authorization` or `Control`: a URL or path, a query, a storage or object key, a Durable Object name, a git revision spec, a glob, a module specifier, a structured header value, and an in-process composite key such as `${file}:${line}`.
A builder takes its parts as named fields, is the only code that writes its layout, and returns its template last; a query comes from `const fields = Schema.encodeSync(QuerySchema)(input);` then `new URLSearchParams(fields)`, and a URL from `new URL(path, origin)`.
Each text part of a request path is percent-encoded with `encodeURIComponent`, and a server that parses the path decodes each part.
A filesystem path is built with `node:path`'s `join`, never a template with `/`, and `+` never forms such a string.
A builder lives in the package that owns the routes or layout it addresses, even when one file uses it, as contract 062 requires, such as `guestExecutionPath` in `@mechane/sandbox-wire`, and never in a constants file; SQL text stays whole in its records function.

**SC-11, name every number in its unit.**
Every number but -1, 0 and 1 is a named module-level constant whose name carries its unit or counted noun, and whose value is one literal in that unit or is built from its unit.
A span is `Duration.<largest whole unit>(n)`, such as `SANDBOX_IDLE = Duration.minutes(15)`, converted with `Duration.toMillis` where it meets an API, a schema bound or the wire; only a wire field or a column keeps `Ms`.
A size of a kibibyte or more is a count of `BYTES_PER_KIBIBYTE` or `BYTES_PER_MEBIBYTE` from `@mechane/records`, such as `OUTPUT_TAIL_BYTES = 50 * BYTES_PER_KIBIBYTE`.
A unit call is a constant's whole value or a property's whole value in a constant's table, such as `COOKIE_LIFETIME`, never nested in another call; no expression combines two literals, a number inside a string comes from a builder, and a count or a character or token limit stays one literal.
Contract 063 names numbers, and its deviation keeps these unit forms.

**SC-12, name HTTP words by their closed sets.**
HTTP methods, status codes, header names and media types are four closed sets, `HttpMethod`, `HttpStatusCode`, `HttpHeader` and `MediaType`, declared once in `@mechane/records`, each alone in its concept constants file, which the package's index exports.
Write members only, such as `request.method !== HttpMethod.Post`, `{ status: HttpStatusCode.NotFound }` and `{ [HttpHeader.ContentType]: MediaType.Json }`.
A narrower set is a schema of members, such as `OperationMethod = Schema.Literals([HttpMethod.Get, HttpMethod.Post])`, never a second object.
A structured header value, such as `cache-control`'s or `authorization`'s, comes from an SC-10 builder; a status another system answers, which no member bounds, is a measured `Schema.Int`.
A change adds a member to the records' sets only for a word they lack, and a program's exit statuses are not HTTP.
Contract 014's shipped rules report method and status literals, and their copies `testing-http-method-literals` and `testing-http-status-literals` the same in the test support package.
`http-literal` reports header names, media types, other status-named keys and status tables.

Violation: `if (request.method !== 'POST') return new Response(null, { status: 405 });` beside ``onEvent: (event) => process.stderr.write(`${JSON.stringify(event)}\n`)``.
Allowed: `if (request.method !== HttpMethod.Post) { return new Response(null, { status: HttpStatusCode.NotFound }); }`, and `const writeEvent: (event: StreamEvent) => void = (event) => writeLine({ event });` above `onEvent: writeEvent`.

## Checks

From `workspaces/core`, run `mise run lint`: oxlint and the ast-grep rules this contract's block lists fail on an enforced rule's finding and hold each ratchet to its baseline, and `mise run checks` holds every baseline to the merge base's.
`mise run rules:explain -- SC-02` prints each rule of an SC id with its message and examples.
Does a callback that the rules let stay inline still read as a projection or an adapter, and does each split's helper name a concept rather than shorten a block?
Is each builder the one place its layout is written, with its parsers reading the same segment constants?

## Local adaptations

The accepted code standard resolves these choices: E1 to E7 stay inline, a behavior file holds one exported operation and its cohesive private helpers, a named callback is a typed const above the statement that passes it with no statement between, ST-28 is amended as SC-02 says, an IIFE replaces a one-use named chooser, no namespace re-export is adopted, the HTTP sets live in `@mechane/records` with the status set named `HttpStatusCode`, conditional types stay, and span constants become `Duration` values in this cleanup while wire fields and columns keep `Ms` or `Seconds`, so SC-01's example chooses a list's wait as a `Duration`.
The cleanup's close adds E8, because ER-08 writes the entry boundary's one catch as a trailing `Effect.catch((failure) => …)`: a named handler there would only restate the boundary that answers every failure. E8 holds only in that trailing position, and ER-08's `catch-all-outside-boundary` keeps `Effect.catch` to `serve`, `servePage` and `runCommand`.
It also decides that a closure's state changes in place: the harness's answer cache keeps the answer entries of earlier commits across a mech's commits, and no constructor rebuilds state that outlives the call, so `dense-loop` skips the `add` and `set` of a `Map` or `Set` that a factory declares at its top and never returns, from a closure the factory declares beside it and answers in its object; a collection an inner function fills for its outer function's one call stays a finding.
oxlint `func-style`, from the file contract 064 ships, keeps `declaration` and allows a typed const arrow. oxlint `unicorn/consistent-function-scoping` checks no arrow, since a named callback stays beside the statement that passes it, and `unicorn/no-array-callback-reference` is off by decision, since a typed callback const states the parameters it reads.
ast-grep `object-arguments` keeps the positional parameters of a typed const arrow, of each arrow of an object a typed const holds, and of a function type in a const's annotation, and `called-positional-const` restores TD-01 for such a const its own file calls by name.
ast-grep `magic-number`, contract 063's rule, lets a module constant's value, or a property of the object that is its value, be one unit call of one literal or a count of `BYTES_PER_KIBIBYTE` or `BYTES_PER_MEBIBYTE`.
The v10 adoption names in SC-11 two forms `magic-number` already allowed.
One is -1, which negates 1 and which contract 063 lets a repository declare bare; the other is a unit call as a property of a constant's table.
The standard's `owned:helpers` check is not built, so review holds SC-02's counting, which it keeps once built.
SC-05 to SC-07 add no rule.
The owned `layout` and `file-names` checks, the barrels normalizer's dry run, the entry-point rules, `import/no-namespace`, knip and the owned `packages` check enforce them, and review judges a criterion.
In the `unexercised` globs a builder makes only `type-only` and `binding-names` changes and lists every other finding for a reviewer and a maintainer's live release verification, so the ratchets keep those sites until then.
Through the cleanup, contract 110's `baselineHold` held each ratchet's total, so a split carried its function's sites to its new file; its close set each file's count back.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `unicorn/consistent-function-scoping` (SC-03): enforced in phase F3, `["error",{"checkArrowFunctions":false}]`
- ast-grep `iife-form` (SC-01): enforced in phase F3
- ast-grep `inline-function-argument` (SC-02): a ratchet until phase F3
- ast-grep `called-positional-const` (SC-03): enforced in phase F3
- ast-grep `nested-function-declaration` (SC-03): enforced in phase F3
- ast-grep `dense-loop` (SC-08): enforced in phase F3
- ast-grep `untyped-failure` (SC-09): enforced in phase F2
- ast-grep `unit-number` (SC-11): enforced in phase F5
- ast-grep `http-literal` (SC-12): enforced in phase F2

<!-- End of the generated block. -->

---
name: code-style
message: Keep operations cohesive, control flow explicit, and paths, units, and HTTP vocabulary consistent.
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
An IIFE never sits in a `case` or `Match` arm; the choice becomes a named function there, when two functions make the same choice, or when its independent behavior deserves a name.
Never fill a `let` in branches, choose a value with `&&`, `||` or `??`.
A conditional type, `T extends U ? X : Y`, has no statement form, so it stays where ST-19 places it.
Contracts 012 and 015 record SC-01's IIFE as a deviation.

**SC-02, keep callbacks readable where they run.**
Use contextual typing for local callbacks. Keep a callback inline when its control flow reads clearly with its caller.
Name a callback when its name explains an operation, separates control flow, or supports real reuse. Do not add a name or adapter solely to satisfy a syntax shape.

**SC-03, make interfaces explicit.**
Give exported operations explicit input and result types. A module-level owned operation takes the object argument required by contract 019.
A callback uses the signature supplied by its receiving interface. Local functions may use contextual typing and the placement that makes their capture and lifetime clear.

**SC-04, keep a concept's operations together.**
A module owns one resource, invariant, or independent behavior. Keep related operations, declarations, and private helpers together.
Export the operations real callers need. Extract for an independent concept or real reuse; inline trivial forwarding glue.
Review whether state changes, effect ordering, and recovery can be understood together.

**SC-05, group by ownership.**
Group related modules in a folder named for their concept. Do not create folders or packages to meet width, depth, or source-size quotas.

**SC-06, keep package APIs explicit.**
Each library package exposes its public API through `src/index.ts` with named exports. A compiler-required defining
module may be an explicit export instead, such as `@mechane/ui/tokens.stylex` under contract 114.
Internal code imports its declaring module directly. Do not add forwarding barrels merely to shorten import paths.
Keep the existing no-namespace import/export convention.

**SC-07, give every package a real boundary.**
Create a package for an executable or artifact, runtime dependency, external interface, state owner, or implementation reused by independent consumers.
A concept can remain a folder inside its owner. Size alone does not justify another package or moving the owner's lifecycle types into one feature.

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
Does each callback make its captures and control flow clear, and does each extracted helper name a real concept?
Is each builder the one place its layout is written, with its parsers reading the same segment constants?

## Local adaptations

The November 2, 2026 cohesion adoption replaces the callback taxonomy, single-export modules, and size-driven package splits.
Existing named callbacks and role files remain valid; they are no longer mandatory for equivalent readable local code.
SQL ownership, runtime lanes, migration locks, boundary decoding, and typed failure channels remain enforced by their owning contracts.
The remaining value, collection, error, path, unit, and HTTP rules retain their generated enforcement below.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `iife-form` (SC-01): enforced in phase F3
- ast-grep `dense-loop` (SC-08): enforced in phase F3
- ast-grep `untyped-failure` (SC-09): enforced in phase F2
- ast-grep `unit-number` (SC-11): enforced in phase F5
- ast-grep `http-literal` (SC-12): enforced in phase F2

<!-- End of the generated block. -->

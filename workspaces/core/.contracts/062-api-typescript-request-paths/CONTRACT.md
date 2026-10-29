---
name: api-typescript-request-paths
message: Build each request path and URL with one typed path function per operation, declared once in the module that owns its routes, and encode each part inside it.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

A request path is the path and query of a URL that code requests, serves, links to, or compares, on the repository's own routes or another system's.
Build each request path with its operation's path function, such as `PackPaths.formatChunk({ index, key })` for one chunk of a pack, and never write it by hand elsewhere.
A fixed path, such as `/health`, also comes from its operation's path function.
Give each path function one named, typed field for each variable part of its path and query, and return the whole path and query that the operation requests.
A path function takes all of its fields in one call and holds no state, so a chained builder that accumulates segments is not a path function.
Never append segments or a query to a path function's result; give the operation's path function a field for each part instead.
Build a full URL by resolving a path function's result against the origin that configuration or the client holds, never by writing an origin into path text.

Declare each path function once, in the module that owns the routes or the stored layout that its paths address, even when that module is its only caller.
The module that owns the client for another system's API owns the path functions for that API.
Import each path function wherever its path is needed, including in tests and in fakes of the server.
When the repository serves an operation's route, derive the route pattern that the server matches and the operation's path function from one declaration.
A client or router may derive each operation's typed call from one declaration of its route pattern and parameters, and that call is the operation's path function.
A generic request function that takes a path template at each call site, such as `request({ account, method: HttpMethod.Get, path: '/accounts/{account}/invoices' })`, writes the path by hand.

Percent-encode each text part inside its path function, as RFC 3986 defines percent-encoding, so callers pass raw values and never encode them.
Encode each segment of a part that spans several segments, such as a file path inside a repository, separately, so its separators stay separators.
Build the query from named fields with a query encoder, never by joining `key=value` text.

Write each path function that the module does not derive in the module's one paths file, whose stem names the module and ends in `paths`, such as `packs/pack-paths.ts`.
Keep only path functions and their private helpers in a paths file, so it sends no request and reads no configuration.
Re-export the paths file from its module's entry point as one namespace, such as `PackPaths` for `pack-paths.ts`, so every call names the owner of its path.
A paths file is a namespace file under `code-module-file-roles`, so it may export one function per operation.

Fail the repository's lint on each template literal and each `+` concatenation that starts with `/` outside the declared paths files, in production and test code alike.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.
The shipped files mark paths files by a stem that ends in `-paths`, and a repository that declares another pattern may override it.
Exempt generated files by a declared path pattern, and suppress a finding only as `code-lint-suppressions` allows, such as for display text or a file-system path.

Violation: four call sites write `/packs/${key}` by hand without encoding `key`, and the server that stores packs slices the same layout from the path again.
Allowed: `packs/pack-paths.ts` exports `formatPack` and `formatChunk`, `packs/index.ts` re-exports it as `PackPaths`, callers request `PackPaths.formatChunk({ index, key })`, and the server matches the pattern that `formatChunk` derives from.

## Checks

Run the repository's lint from the repository root, and confirm that it reports a template literal that starts with `/` in a file outside the declared paths files.
For each request path or URL a change builds, does it come from its operation's path function, declared once in the module that owns the routes?
For each path function a change adds, does each variable part arrive as a typed named field, and does the function encode each text part?
Does a change join an origin, a base URL, or a path function's result with more path or query text, such as `${baseUrl}/packs/${key}`, which the lint does not report?
For each route a change serves, do the server's route pattern and the operation's path function derive from one declaration?

## Local adaptations

A served route's pattern and its typed call derive from its operation's one declaration in `@mechane/protocol`'s catalog. The client builds each request from it with `requestUrl`, which percent-encodes each part, so that call is the operation's path function.
Every other request path or URL comes from an SC-10 builder named for what it returns, such as `guestExecutionPath({ machineId, executionId, wait })`. Each builder is declared in the package that owns the routes or the layout it addresses, even when one file uses it, such as `@mechane/sandbox-wire` for the guest's and the launcher's routes. A builder percent-encodes each text part with `encodeURIComponent` and builds its query from a schema's encoding with `URLSearchParams`, and the guest and the launcher decode each part as they parse a path.
ast-grep `inline-path-string` (SC-10) enforces the lint sentence.
It rejects a path-like template outside a builder's returned value, which it finds by the builder's name, and every `+` that forms such a string.
It skips prose that holds a space.

Deviation (ST-18, SC-04, SC-06): each builder is a behavior file of its own named for it, such as `guest-health-path.ts`, re-exported by name from its package's entry point when another package imports it. So "Write each path function that the module does not derive in the module's one paths file, whose stem names the module and ends in `paths`", "Keep only path functions and their private helpers in a paths file", "Re-export the paths file from its module's entry point as one namespace", "A paths file is a namespace file under `code-module-file-roles`" and the Allowed example's `PackPaths` are not adopted.
Deviation (D9, fixed paths): another system's fixed path is a constant beside the one client or fake that requests or serves it.
GitHub's are members of the closed set `GitHubPath` in `@mechane/protocol`, which the Worker's pages and the local stack's GitHub both import, so the client and the fake read one declaration.
celld's health path sits beside the stack's startup probe, and OpenRouter's paths beside the scripted upstream that serves them, as `ScriptedPath`.
The deploy program's `API_ORIGINS` holds Cloudflare's API base and OpenRouter's key endpoint as whole URLs, since only that program calls them.
This replaces "A fixed path, such as `/health`, also comes from its operation's path function" and "never by writing an origin into path text" for another system's fixed paths.
Deviation (D9, parameterless operations): a program that does not depend on `@mechane/client` resolves a parameterless operation's declared `path` against the origin, which is the URL `requestUrl` builds for it.
The stack's startup probe, the smoke's burst of raw requests and the live release verification do so.
This replaces "A fixed path, such as `/health`, also comes from its operation's path function" for those programs.
The smoke's `linkedCodeQuery` writes the query a phishing link carries, which no route declares and the device page must ignore.
So it stays beside its one scenario and encodes its one field with `URLSearchParams`, from no schema.
Deviation (D9, served patterns): the guest and the host launcher parse a path by splitting it against `GuestSegment`, the segment set their builders write, rather than matching a pattern derived from the builder. This replaces "When the repository serves an operation's route, derive the route pattern that the server matches and the operation's path function from one declaration" for those two servers.
Deviation (AS-02): the lint does not load the shipped `request-paths` rules.
They find a builder by a `-paths` file stem that no Mechane file has, and they report generated comment and attribute text that is no request path.
This replaces "Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration" and "The shipped files mark paths files by a stem that ends in `-paths`, and a repository that declares another pattern may override it".

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `inline-path-string` (SC-10): a ratchet until phase F2

<!-- End of the generated block. -->

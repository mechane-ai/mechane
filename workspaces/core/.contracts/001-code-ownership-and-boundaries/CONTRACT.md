---
name: code-ownership-and-boundaries
message: Give decisions and state one owner, with explicit dependency direction.
paths: ["**/*.ts", "**/*.tsx", "**/package.json", "dependencies.json"]
---

## Rules

Give each operation and durable fact one owner.
Keep domain decisions separate from provider transport, storage, and terminal rendering.
Pass explicit inputs and results across those boundaries.
Identify allowed dependencies from the declaration that `code-dependency-boundaries` requires, and public entry points from the nearest package contract.
Import another package only through a declared dependency and its public entry points, never its private modules; keep relative imports inside the owning package.
Consume another repository only through versioned artifacts or explicitly configured endpoints, never through a sibling checkout or an untracked filesystem path.
Keep test fixtures out of production code and builds.

Prefer modules or folders for internal organization.
Add a package for a current ownership, runtime, dependency, or reuse boundary.
Keep cohesive state transitions together.
An abstraction should reduce the decisions and internal knowledge required of its callers; a forwarding layer alone does not establish a useful boundary.

Use the same execution path for equivalent local and deployed behavior; infrastructure adapters may differ.
When replacing a boundary, update consumers, exports, commands, and documentation together.
Account for stored data and active consumers.
Remove superseded paths, options, dependencies, fixtures, and guidance when no current need remains.
Give a necessary temporary path an owner and removal condition.

## Checks

Trace an affected operation from entry point to result.
Identify the owner of each decision and state transition.
Inspect package manifests, public exports, and outside imports together.
Confirm that no import resolves to another package's private module, a sibling checkout, or an untracked path, and that production builds contain no fixtures.
Can a caller use the operation without knowing its private sequencing or repairing its result?
Use the owning workspace's existing checks.

## Local adaptations

`dependencies.json` declares package ownership, layer, runtime lane, and consumers. Each package manifest declares
its dependencies and public exports. A public entry point normally targets `src/index.ts`; native compiler and
executable entries may target their defining module when their consumer requires it.

`@mechane/runtime` owns domain state and native SDK execution. `@mechane/server` composes the HTTP server, public
World lifecycle, and Console assets. The sandbox service owns only the authenticated compute boundary and public
reverse proxy. These boundaries are not alternate agent engines.

The local stack in `packages/node/stack/src` serves development and smoke runs. It launches the compiled Node server
against real Postgres and uses the same runtime entry as deployment. External GitHub, Slack, Nexus, and model fixtures
live in the stack's `fixtures` directory, behind configured HTTP endpoints. Product code imports no fixture.
The local compute fixture runs the real sandbox service and guest process through a host launcher; it proves the
protocol and receipt lifecycle, not container or operating-system isolation. Hosted qualification verifies that
separate boundary. Production artifacts exclude all fixture and smoke code.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

---
name: code-typescript-module-boundaries
message: Share code across source folders only through each folder's explicit named-export entry point, and keep imports between files acyclic, type-only and dynamic imports included.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Give each source folder that other folders import an entry point, `index.ts` unless a tool requires another file name.
Export every value and type the folder shares by name from that entry point.
Do not use default exports or wildcard re-exports in source folders, except where a tool defines the export format, and write a namespace re-export only in an entry point, as `code-typescript-entry-points` allows.
Export a symbol from a folder's entry point only when production code outside the folder uses it.
The entry point of the test support folder that `test-support-modules` declares may also export what only test files use.

A file may import any file directly in its own folder or in a folder that contains it, except the package's own entry point, such as `orders/lines/sum.ts` importing `orders/format.ts`.
Import every other folder only through its entry point, including type-only imports, re-exports, and dynamic imports.
`code-typescript-entry-points` governs how an entry point re-exports the symbols of its nested folders.
Treat nested folders as part of their parent's boundary, and expose what an outside consumer needs from a nested folder through the parent's entry point.
Share behavior that several folders need through its own named folder, not by importing another folder's private file.
Keep the import graph between source files acyclic, and count type-only imports, type re-exports, and dynamic imports as edges of that graph.
Break a cycle by moving the declarations both sides need into the module that owns them, as `code-module-file-roles` places types and constants; changing an import to a type-only import does not break a cycle.
Import sibling folders directly from production modules, not through the package's own entry point; tests and examples may use the package entry point to exercise the consumer API.
Keep server-only modules out of entry points that browser code imports.
Declare a maximum number of distinct modules that one file imports, counting type-only imports and not re-exports; the shipped file sets 10, and a repository may override it.

Enforce the cycle and entry-point rules with a dependency check that resolves each import to a file, never with a pattern over import text.
Configure that check to fail on a cycle through any import, on an import that bypasses an entry point, and on a relative import it cannot resolve.
The repository's lint may extend or run the configuration that this contract ships under `assets/`.
That configuration reports each of those failures except a cycle through a dynamic import, an `import()` type, an import-equals declaration, or `require()`, and it skips dot-named files.
List in that configuration every `tsconfig.json` that declares path aliases, or the check treats those imports as packages and misses their bypasses.
Suppress a cycle or entry-point finding only as `code-lint-suppressions` allows.

Violation: `orders/totals.ts` adds `import type { Invoice } from '../invoices.ts'` while `invoices.ts` imports `./orders/index.ts`.
Violation: `refunds/send.ts` imports `../orders/lines/sum.ts`, past both `orders/index.ts` and `orders/lines/index.ts`.
Allowed: `Invoice` moves to `billing/types.ts`, and both files import it through `billing/index.ts`, which imports neither of them.
Allowed: `orders/lines/sum.ts` imports `../format.ts`, a file directly in `orders/`, the folder that contains it.

## Checks

Run the repository's dependency check from the workspace root, and confirm that its configuration fails on type-only, re-export, and dynamic-import cycles, on entry-point bypasses, and on unresolved relative imports.
For each change to that configuration, does every one of those rules stay at error for every source folder?
Does that configuration read every `tsconfig.json` in the repository that declares path aliases?
Does a cycle fix move the shared declarations into the module that owns them, not into a forwarding layer that `code-ownership-and-boundaries` rejects?
Review each changed entry point, and confirm every named export has a production consumer outside its folder, or a test consumer for the test support folder's entry point.
Trace outside imports of a moved file to the entry point that exposes it.

## Local adaptations

The boundaries check of `mise -C workspaces/core run checks` cruises once with `.dependency-cruiser.cjs` and fails on every import its rules forbid.
Among them are a cycle through any import, type-only and dynamic imports included, since swc keeps type-only ones, and an import it cannot resolve.

Deviation (ST-09): only a library package has an entry point, its `src/index.ts`, which its manifest's exports map lists; no other folder has one.
A file imports each name from the file that declares it, never through an `index.ts` and never through its own package's entry, which the barrels normalizer's dry run rejects.
This replaces "Give each source folder that other folders import an entry point" and "Export every value and type the folder shares by name from that entry point".
It replaces "Import every other folder only through its entry point, including type-only imports, re-exports, and dynamic imports" too.
It also replaces "Treat nested folders as part of their parent's boundary, and expose what an outside consumer needs from a nested folder through the parent's entry point".

The check's failure on an import that bypasses an entry point goes as well, with the Violation of `refunds/send.ts` importing `../orders/lines/sum.ts`.
An import of a file in the importer's own folder or a folder that contains it, which the contract now allows, needs no deviation.

The barrels normalizer of `mise run fix` rewrites each import that passes through an `index.ts` to the declaring files and removes the `index.ts`.
Its dry run fails the checks on any import it would rewrite.
A package's own files import its declaring files from every source root, its `scripts` as well as its `src`.
It only moves imports, so it runs over the folders that only the live release verification runs too (TS-07).
Its commits are proven by the fingerprint, or by the same module bodies in the unminified bundle where a removed barrel changes the order of a bundle's modules.

The lint does not run the `eslint-plugin-boundaries` configuration this contract ships under `assets/`, which the contract leaves optional.
It fails every import past a folder's `index.ts`, the one form ST-09 allows, and the cruise already fails on what else it configures.
No `tsconfig.json` declares `paths`, so no alias hides a bypass.
The testing package's `src/index.ts` exports what only the smoke imports, as a test support folder's entry point may, and knip checks it in its default run only (ST-11).

The v11 import-count maximum is outside the current adoption scope.
The import graph and package limits retain the strict standard's baseline at commit 94f2d0f; choosing an import-count limit needs its own registry rollout.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

The generated configurations carry `cruiserOptions`, `cruiserNotes`.
- dependency-cruiser `no-circular` (ST-07): enforced: Break the cycle by moving what both files share into a file of its own, such as `session/types.ts`; type-only and dynamic imports count as edges
- dependency-cruiser `not-to-unresolvable` (004): enforced: Import a file that exists or a declared package, such as `./store.ts` or `effect`
- normalizer `barrels` (ST-09): enforced in phase D

<!-- End of the generated block. -->

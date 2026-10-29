---
name: code-typescript-package-boundaries
message: Consume TypeScript packages only through declared dependencies and explicitly exported entry points.
paths: ["**/package.json", "**/*.ts"]
---

## Rules

Give each TypeScript application and package its own manifest that declares its name, dependencies, and supported entry points.
List supported entry points in the manifest's exports map, and treat every other file as private; see `code-ownership-and-boundaries` for importing only through public entry points.
Never re-export every folder from one package-wide barrel; `code-export-consumers` decides which symbols an entry point exports.
Add an entry point only when a consumer outside the package that `code-export-consumers` accepts needs that API.
Preserve entry-point file names and export formats that a tool requires.

Declare every package you import as a dependency of the importing package rather than relying on a transitive or hoisted install.
Depend on packages in the same repository through the package manager's workspace links, and on packages from other repositories through exact published versions.

## Checks

Inspect changed imports, exports, and dependency declarations together.
Search changed imports for package subpaths that the target package's exports map does not declare.
Confirm each new entry point has a consumer outside the package that `code-export-consumers` accepts.

## Local adaptations

Each package's exports map lists only `./src/index.ts`; `@mechane/cli` has a `bin` and no exports, and `@mechane/app` has neither, because Wrangler loads its `main`.
Workspace members depend on each other through `workspace:*`, and on every other package through the exact version that `pnpm-lock.yaml` locks.
`@mechane/guest` has no exports: `build:guest` bundles its `main.ts` into the image folder's gitignored `guest.mjs`, which the image copies and the host launcher runs.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `no-non-package-json` (ST-06): enforced: Declare the package in the importing package's manifest before importing it, such as `"effect": "catalog:"`

<!-- End of the generated block. -->

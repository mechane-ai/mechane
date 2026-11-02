---
name: code-typescript-file-names
message: Name TypeScript modules for their concept or behavior in kebab-case.
paths: ["**/*.ts"]
---

## Rules

Use lowercase kebab-case for TypeScript source files and folders. Name an operation module for its operation and a concept module for the resource or invariant it owns.
A module with related exports does not need to match any single export. Preserve tool-required entry names and generated metadata.
Use a dotted role suffix only for a declared role, such as schemas or errors, and keep its contents consistent with that role. Do not introduce catch-all helpers or utilities suffixes.
Keep package entry points and executable main.ts files at the paths their tooling declares.

## Checks

Run the filename-casing lint and verify that changed import paths resolve.
For each new name, identify its concept or operation without relying on an incidental export count.

## Local adaptations

The November 2, 2026 cohesion adoption replaces the upstream structural quotas with ownership and readability review.
Existing special-purpose files remain valid; changing a caller count does not require moving declarations.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `unicorn/filename-case` (NM-20): enforced, `["error",{"case":"kebabCase"}]`

<!-- End of the generated block. -->

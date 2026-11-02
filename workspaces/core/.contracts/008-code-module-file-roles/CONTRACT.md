---
name: code-module-file-roles
message: Keep each module cohesive and expose only the operations its callers need.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Give each module one resource, invariant, or independent behavior. Keep its related operations, schemas, types, constants, and private helpers together when that makes the behavior easier to follow.
Export only what actual callers use. Related operations may share one module; do not split a file solely to reduce its line count or number of exports.
Keep a shared concept with its owner. Adding a caller does not change that ownership or require moving declarations into a role file.
Use a dedicated types, constants, schemas, or errors file when those declarations form a useful shared boundary. A file named types holds only types; a file named constants holds only constants and derived types.
Keep migrations in their declared migration files. Preserve the public entry points, SQL ownership, and runtime boundaries established by the owning contracts.
Name a concept module for its concept; name an operation module for its operation. Keep executable entry points in main.ts.

## Checks

Trace one affected behavior from its public operation through its state changes and recovery. Can the reader understand it without following trivial forwarding helpers?
For each extraction, identify the independent concept, real reuse, or boundary it creates. For each consolidation, confirm the same authority and transaction boundaries remain visible.
Run the compiler, import-boundary checks, and stored-format checks. Review module cohesion directly; file and export counts are not correctness checks.

## Local adaptations

The November 2, 2026 cohesion adoption replaces the upstream structural quotas with ownership and readability review.
Existing special-purpose files remain valid; changing a caller count does not require moving declarations.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `declaration-file-role` (ST-20): enforced
- ast-grep `types-file-role` (ST-20): enforced

<!-- End of the generated block. -->

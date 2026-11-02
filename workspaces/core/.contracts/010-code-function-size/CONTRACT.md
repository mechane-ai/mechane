---
name: code-function-size
message: Keep decisions, state changes, effects, and recovery understandable together.
requires-tenet: 0.11.0
paths: ["**/*.ts", ".oxlintrc.json"]
---

## Rules

Keep each operation's decisions, state changes, effects, and failure paths readable in sequence.
Extract a helper when it names an independent concept, removes real duplication, or isolates a useful operation. Keep related branches together when extraction would obscure their shared invariant.
Use function size, nesting, and complexity as review signals. They do not impose extraction quotas or a mandatory shape for every switch case or callback.
Keep migration callbacks self-contained and immutable once deployed. A migration file holds its imports and migration steps, so helpers cannot silently change a locked migration.

## Checks

Trace the changed operation, including interruption and failure. Does extraction reduce the context needed to explain it?
Inspect complex branches and nested callbacks for a clearer sequence, without moving the same complexity behind forwarding helpers.
Run migration-lock and migration-file checks. Review readability directly rather than treating a line count as evidence.

## Local adaptations

The November 2, 2026 cohesion adoption replaces the upstream structural quotas with ownership and readability review.
Existing special-purpose files remain valid; changing a caller count does not require moving declarations.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `migrations-statements` (ST-22): enforced in phase B

<!-- End of the generated block. -->

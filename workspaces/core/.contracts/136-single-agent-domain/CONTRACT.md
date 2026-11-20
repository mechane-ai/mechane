---
name: single-agent-domain
message: Keep Claude Managed Agents as the sole public agent execution domain without coupling managed modules to retired mech tables or handlers.
paths: ["packages/worker/runtime/src/managed/**", "packages/worker/server/src/managed/**", "packages/worker/control-store/src/store/managed/**", "packages/shared/protocol/**"]
---

## Rules

Managed Agents resources (`agents`, `environments`, `sessions`, `threads`, `events`, `vaults`, `memory_stores`, `skills`)
are the single public agent execution model. Managed runtime and server handlers must not import retired `actor/archive`,
`operations/mechs`, `operations/turns`, `operations/routines`, `http/import-mech`, or `http/mech-maintenance` modules.
Managed control-store modules and new database migrations must not introduce new foreign keys or writes to retired
`mechane.mechs`, `mechane.turns`, `mechane.runs`, or `mechane.console_messages` tables.

Keep first-party operator routes strictly scoped to workspace administration, authentication, service principals,
spending limits, agent attention inspection, and readiness.

## Checks

Run dependency-cruiser and the ast-grep ratchet over managed runtime, server, and control-store modules to confirm zero
new imports of retired mech/turn/archive modules and zero new `mechane.mechs` SQL references.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `managed-no-mech-runtime-imports` (136): enforced: Keep managed runtime and server handlers free of retired mech and archive modules, such as `@mechane/session-runtime`
- ast-grep `managed-no-mech-table-sql` (136): enforced

<!-- End of the generated block. -->

---
name: durable-object-isolation
message: Separate per-agent execution slot arbitration from per-session Pi Harness Durable Objects without SQLite table prefixing.
paths: ["packages/worker/runtime/**", "packages/worker/agent-slot/**", "packages/worker/server/**"]
---

## Rules

Give each named agent one lightweight execution-slot Durable Object (`AgentSlotObject`) that owns only the active
session/thread lease, monotonic epoch fence, FIFO wait queue, and dead-lease alarm. Keep `AgentSlotObject` free of Pi
Durable, model providers, and session transcript storage so attention arbitration remains constant-size regardless of
archived session history.

Give each Managed Agents session its own `SessionObject` Durable Object owning one unprefixed `@earendil-works/pi-durable`
`Harness`. Run root threads, delegated child threads (including self-delegation), and isolated outcome graders as native
Pi conversations inside that session's `Harness`, each acquiring its owning agent's `AgentSlotObject` before any model
call or consequential tool dispatch. Never shard multiple Managed Agents sessions into one Durable Object by passing a
dynamic `prefix` to `openDurableObjectSqliteStorage`. Session deletion seals and calls `storage.deleteAll()` in O(1).

## Checks

Verify that `AgentSlotObject` carries no imports from `@earendil-works/pi-durable`, model gateways, or catalog stores.
Verify that no session storage passes a `prefix` option to `openDurableObjectSqliteStorage`. Exercise two contending
sessions, cross-agent and self-delegation, mid-turn actor crash with lease reclaim, and O(1) session deletion through
the smoke catalog.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `agent-slot-isolation` (135): enforced: Keep per-agent slot arbitration free of Pi Durable, providers, and catalog stores, such as `agent-slot-object.ts`
- ast-grep `no-prefixed-session-sqlite` (135): enforced

<!-- End of the generated block. -->

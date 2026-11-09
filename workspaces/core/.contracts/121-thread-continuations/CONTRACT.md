---
name: thread-continuations
message: Treat external decisions and completion events as correlated notifications without blocking the mech or inventing effects.
paths: ["packages/node/runtime/src/{execution,tools,store}/**", "packages/node/server/src/**", "packages/shared/protocol/src/operations/notifications/**"]
---

## Rules

Deliver external decisions and background results through the same durable notification boundary as other producers.
Keep request kinds, approval policy, provider grants, and platform routing in their owning integration. Mechane stores
verified producer identity and opaque correlation data; it does not interpret an approval as a tool result.

Let an application request return its stable reference while the mech continues other work. Waiting for a person's
answer must not hold the single model owner, poll from a model call, or occupy a shell process. A new decision wakes the
mech through ordinary notification scheduling, including after host replacement and after an earlier activation ended.

Keep each notification's source and correlation immutable. Duplicate delivery retains its original receipt, while changed
content under the same identity is refused. A reply destination is explicit tool input; it is never a mutable ambient
route inherited from the latest notification. Integration-owned correlation lets the agent find the original request
without assuming that every later notification belongs to it.

Treat a ready event as a reason to inspect the authoritative request and current permission. It proves neither that the
operation ran nor that access remains active. A denied, expired, revoked, canceled, or superseded request must not silently
execute its old arguments. The agent chooses a fresh permitted action using current context. Decision intake itself posts
no message, reaction, completion, or failure to an external conversation.

## Checks

Using a real compiled workflow and Postgres, admit an external result while the mech is idle, active on other work, and
restarting. Verify each event remains available once without another human message or an approval-specific model poll.
Repeat a producer event and change its content under the same identity; only the unchanged duplicate may reuse receipt.

Deliver a decision after cancellation, revocation, and supersession. Confirm intake performs no old tool call or channel
post. In the owning integration's acceptance flow, read current authority before the explicit follow-up effect and use
its recorded destination despite intervening notifications from another source.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

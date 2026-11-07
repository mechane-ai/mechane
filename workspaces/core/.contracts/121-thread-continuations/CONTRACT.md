---
name: thread-continuations
message: Resume the original durable work from authenticated external decisions without duplicating it or changing its reply destination.
paths: ["packages/node/runtime/src/{execution,requests,store}/**", "packages/node/server/src/**", "packages/shared/protocol/src/operations/threads/**"]
---

## Rules

Keep tracked work items distinct from conversation sessions and execution runs. A work item records the agent's
progress; a native Workflow owns the execution that can wait. Do not recreate the former alarm-driven inbox or poll
an approval from a model call or a shell process.

Persist each external request's stable identity, request kind, service identity, and original source before submission.
Register the native Workflow hook before the external service can resolve it. Durable decision intake also retains
early events until their correlation exists, so timing cannot lose a decision.

Accept only authenticated Nexus events for the configured service. Verify the raw signed payload, timestamp, event
identity, and request correlation. Store acceptance before returning success. Duplicate delivery and process
replacement must neither repeat the external submission nor resume closed work.

A ready event means permission may be available; it does not prove the operation ran or that a grant remains active.
Read Nexus's authoritative request or collection before use. Denial, expiry, cancellation, changed service authority,
and permission revocation have explicit outcomes. A late decision cannot reopen canceled or resolved work.

Keep the original requester and reply route immutable. Resumed work uses that route even after other messages arrive.
Current Slack installation and binding policy still govern delivery. A workflow waiting for approval consumes no
model request or shell command. It resumes automatically when the authenticated decision arrives.

## Checks

Run a real compiled workflow against Postgres, interrupt its process while it waits, then send the authenticated
decision after restart. Verify the same work completes once and replies in its original destination without another
human message. Repeat an event and deliver one before correlation registration.

Exercise denial, expiry, cancellation, a changed service identity, and revocation after a ready event. Inspect the
replay for duplicate model calls or external effects and verify that waiting itself makes no model calls.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

---
name: mech-notifications
message: Admit immutable notifications into one persistent mech and deliver scheduled or external outcomes without held waits.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/worker/control-store/**", "packages/shared/protocol/src/operations/notifications/**", "packages/shared/protocol/src/operations/routines/**", "packages/node/commands/**"]
---

## Rules

Use one generic notification boundary for operator messages, verified integration events, application decisions,
background results, and scheduled wakes. Source and thread metadata are correlation, never another mech identity or
an authority channel. Platform verification, approval policy, provider grants, and destination routing belong to the
integration owner. Authenticate the producer and bind its allowed recipients before admission.

Make notification identity and content immutable. In one Harness transaction, compare a canonical payload digest and
admit through Pi's public submission API with the stable request identity. Persist the receipt before returning
acceptance. Identical retries reuse it; changed payloads conflict. Pi's own request deduplication does not compare the
application payload. Acceptance proves storage, not model observation or completion.

Keep notification admission independent of control delivery and remote tool discovery. A configuration command waits
for refresh acknowledgments of its own committed recipient outbox rows before reporting success; notification intake
does not wait for that refresh. If acknowledgment fails, report that configuration was saved but runtime refresh is
unconfirmed. A failed confirmation cannot erase an accepted notification or roll back the committed configuration.
On a fresh scope without installed tool configuration, retain accepted input in the existing durable pending owner
until its first preparation completes. A cold actor restores its sanitized configuration projection locally before
native progress, so restored work and reads do not require remote discovery. Partial discovery records explicit tool
availability notices and leaves configuration confirmation pending; available ordinary tools may still run.

Use steer admission for every actionable busy notification with all pending steers placed at the next supported
boundary. Do not expose a deferred follow-up mode that can block tools while remaining unavailable to their model.
Record observation from the actual generation context. A sequence watermark is valid only when its coverage has no
holes. Derive that coverage from Pi's native cutoff, prepared entries, and their actual context contributions. An
accepted notification does not invalidate a private generation already using an earlier cutoff; let Pi incorporate
the steer at its supported boundary. New effects from that generation still require the latest admitted input to be
observed. Preserve accepted input through generation failure and the final-to-idle race with a bounded continuation
policy. Pi settlement does not prove that the user's request was fulfilled.

Let an application request return a stable receipt. Human waiting must not hold a model owner, poll inside a model
call, or occupy a shell process. An external outcome becomes another notification, including after the earlier
activation ended. An access-ready result requires checking current authority. An approved action may already have
been executed by Nexus; read that action's receipt rather than submit it again. Decision intake itself sends nothing.

Scope self commands to the authenticated mech. Persist a future wake before acknowledgment and return immediately.
Resolve a relative deadline once on first acceptance. Retrying its request identity retains that deadline; changed
intent conflicts. At delivery, atomically settle the schedule and admit the notification. Cancellation returns canceled
or already delivered. Use the actor's single alarm owner, not a process sleep or a second timer scheduler.

Keep recurring routines in the mech actor with human-configurable text, bounded intervals, and revision-checked changes.
Use native Pi sleeping tasks and the existing actor alarm. Compute each due slot from its revision's absolute anchor.
Admit the slot's stable notification identity and advance the native sleep in one transaction. After downtime or a
mech pause, deliver only the latest missed slot and then return to the absolute cadence. Never replay a backlog of ticks.
Fence superseded revisions before admission. Disabling or deleting a routine stops future deliveries and preserves
accepted notifications, history, and receipts. Keep deletion receipts so delayed retries cannot recreate old schedules.
Identical mutation retries return the accepted revision; changed or stale revisions conflict.

Report due time, inbox delivery, and actual model observation as distinct evidence. Record observation only from the
generation's prepared context and an internal routine delivery receipt. Routine text is ordinary input, not a privileged
instruction. Delivery performs no application action or public reply; the model chooses its tools under current policy.

Keep explicit destinations on outward tool calls. A later notification cannot change a pending request's destination.
Denied, expired, revoked, canceled, or superseded access never authorizes old arguments. Integration delivery retains
its own stable identity across lost acknowledgments and temporary recipient unavailability.

## Checks

Through the real compiled notification route, exercise identical and changed duplicate input, concurrent delivery,
active steering, failed generation, admission during restart, and the final idle boundary. Assert the next guarded
provider context contains every actionable admitted input. A private completion must not create a public reply.
Accept a steer between context preparation and provider dispatch: the private generation may finish, its stale new
effects must not start, and Pi must incorporate the notification without a fatal local admission error.

Schedule a short wake, kill the application before and after admission/alarm setup, and verify one eventual input.
Repeat scheduling and cancellation with the same identity. Exercise delivery racing cancellation and require one
honest result. Cross the Postgres control-outbox commit/delivery boundary and verify recovery after lost acknowledgment.
Hold a recipient's tool discovery while changing configuration. Observe the committed configuration independently,
admit input without waiting for discovery, then release the refresh and require the command's acknowledgment before
checking newly offered tools. Unrelated pending outbox rows must not gate that command.
Pause a mech across multiple routine slots, restart, and resume it. Require one latest-slot notification and model
observation, then disable during that accepted work and require completion without duplicate paid work or publication.
Retry configuration and deletion, reject changed duplicate intent, and inspect the retained observation and run identity.
Restart with a held MCP endpoint and require receipt/read availability and native cleanup from locally restored
configuration. Fail discovery and require saved-but-unconfirmed configuration, retained pending input, and eventual
progress through the same alarm rather than another human message.

Deliver access and action outcomes after cancellation or revocation. Intake cannot run a provider action. In the
owning Nexus flow, inspect current access or an already executed action receipt and publish only through an explicit
tool. Host replacement must not require another human message to resume accepted work.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

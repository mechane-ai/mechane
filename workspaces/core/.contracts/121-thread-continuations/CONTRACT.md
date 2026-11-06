---
name: thread-continuations
message: Resume durable work through the existing inbox without duplicating wakeups or changing its original reply destination.
paths: ["packages/worker/harness-tools/src/threads/**", "packages/worker/mech-ports/src/threads/**", "packages/worker/mech-store/src/threads/**", "packages/worker/mech/src/threads/**", "packages/worker/mech/src/alarm/{catch-up,read-host-deadline}.ts", "packages/worker/mech/src/slack/**", "packages/worker/mech/src/turns/end-item-turn.ts", "packages/node/smoke/src/drones/thread-wakeup-survives-restart.ts"]
---

## Rules

Use existing work threads, alarms, and inbox admission. `update_thread` may set a bounded wakeup only while waiting.
A later update replaces the outstanding wakeup; resolving the thread cancels it. Replaying the same tool task returns
its recorded result without scheduling another delivery or overwriting newer state.

Keep due work replaceable until the primary conversation, pending inbox, and drones are idle. Admit one due continuation
atomically with its stable inbox identity. Clear its deadline in the same transaction. Paused mechs retain deadlines;
busy or paused work must not repeatedly arm an already-due alarm. Resume and normal completion reconsider due work.

Capture the trusted originating inbox item when work opens. Continuations keep that original route, including work
opened from another continuation. A later message cannot redirect the reply. Use the existing Slack outbox and its
current binding checks; a scheduled continuation does not impersonate a new Slack message.

A Slack-originated turn that ends without an answer still reports its terminal reason through the same outbox and
original route. Keep that notice distinct from a successful agent reply, and do not expose raw provider errors or
credentials.

The agent chooses checks and subsequent actions. A wakeup is input, not permission or proof that an external operation
completed. Keep the existing single primary execution and arbitrary-command uncertainty semantics.

## Checks

Run the continuation smoke with a runtime restart and verify a single resumed turn. Exercise replacement and resolution
before the deadline. Review the idle gate alongside deadline scheduling so retained work neither stalls nor spins.
Verify a real Slack-originated wait replies in its original thread after another conversation arrives. Rebind or mute
that Slack destination and confirm existing outbox authorization still applies.
Check a refused or canceled turn in Slack during hosted qualification.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

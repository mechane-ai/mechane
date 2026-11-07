---
name: thread-continuations
message: Resume durable work through the existing inbox without duplicating wakeups or changing its original reply destination.
paths: ["packages/worker/harness-tools/src/{threads,requests}/**", "packages/worker/harness/src/{create-inbox-submission,deliver-inbox-item,constants}.ts", "packages/worker/mech-ports/src/threads/**", "packages/worker/mech-store/src/{threads,slack,requests}/**", "packages/worker/mech/src/{threads,requests}/**", "packages/worker/mech/src/alarm/{catch-up,drive-mech,run-alarm,read-host-deadline}.ts", "packages/worker/mech/src/slack/**", "packages/worker/edge/src/slack/**", "packages/worker/integrations/src/slack/**", "packages/worker/workspace/src/slack/**", "packages/shared/records/src/slack.schemas.ts", "packages/shared/protocol/src/operations/slack/**", "packages/worker/mech/src/turns/end-item-turn.ts", "packages/node/smoke/src/drones/thread-wakeup-survives-restart.ts", "packages/node/testing/src/{slack,requests}/**"]
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

Persist an access submission's stable request ID before contacting its service. A pending access request registers its
wait automatically. An existing external request may be attached to open work through the same wait path. Each thread
holds one replaceable wait, pinned to the original collection and credential reference. Poll only from bounded host
alarms; no model request or shell command remains open to observe a decision. Transient transport failures retry within
the wait's expiry; permanent failure and expiry produce explicit terminal input.

Terminal request state schedules exactly one ordinary continuation through the existing thread update and original
inbox route. Duplicate responses and runtime replacement cannot repeat admission. Replacing, resolving, or canceling a
thread clears both pending polling and a terminal continuation not yet admitted. Forks inherit no operational waits.
An approval is permission to continue the requested operation, not evidence the operation itself completed.

Give each bound human request a durable visible acknowledgement or useful refusal before relying on model execution.
Keep notices in the existing outbox with stable keys separate from terminal reply identities. Notices can run while
the mech is paused, but still check current installation, destination, reply switch, and workspace suspension. A paused
acknowledgement says the request is queued. Retries never duplicate a notice or suppress a later agent reply.

Bind requester identity to the signed Slack event's user and team. An owner's optional allowed-user list gates inbox
admission using that verified user, never display names, message text, attachments, or guest-provided headers. Recheck
current binding policy on retries. Bots, edits, invalid signatures, and unbound audiences create neither work nor replies.

Keep attachment metadata with the original inbox item. Captions remain usable when files cannot be read. Unsupported
file-only input gets a visible explanation without a model call. The trusted integration reads only bounded images
from Slack's exact private-file host; credentials and unauthenticated file URLs never reach model input.
Bound the complete serialized image submission, including caption, file notes and request metadata, before pi stores it.
Keep headroom below the durable SQLite row limit. Omit excess images with an explicit model-visible explanation, preserve
the caption, and bound attachment labels. A per-file download limit does not bound a multi-image submission.

The agent chooses checks and subsequent actions. A wakeup is input, not permission or proof that an external operation
completed. Keep the existing single primary execution and arbitrary-command uncertainty semantics.

## Checks

Run the continuation smoke with a runtime restart and verify a single resumed turn. Exercise replacement and resolution
before the deadline. Review the idle gate alongside deadline scheduling so retained work neither stalls nor spins.
Verify a real Slack-originated wait replies in its original thread after another conversation arrives. Rebind or mute
that Slack destination and confirm existing outbox authorization still applies.
Check a refused or canceled turn in Slack during hosted qualification.
Extend the existing signed-callback smoke to exercise allowed and refused users, a repeated caption, unsupported
file-only input, and paused notices. Assert durable work and delivery outcomes rather than exact acknowledgement prose.
Check actual serialized pi entries with several maximum-size images and an escape-heavy maximum-length caption. Confirm
the stored record remains below the platform limit and preserves both the caption and an explanation of omitted images.
Extend the existing continuation smoke across pending restart, grant, denial, late readiness after cancellation, and
repeated terminal observation. Check no model turn is spent while pending and no closed work is reopened by replay.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

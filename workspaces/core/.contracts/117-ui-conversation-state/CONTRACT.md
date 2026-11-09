---
name: ui-conversation-state
message: Preserve the reader's position and the author's draft while presenting supplied messages and activity.
paths: ["packages/browser/elements/packages/ai/**","packages/browser/console/src/conversations/**","packages/browser/console/src/drafts.tsx","packages/browser/console/src/screens/mech.tsx","packages/browser/console/src/screens/message.tsx","packages/browser/console/src/screens/conversation.tsx","packages/browser/console/src/screens/conversation-activity.tsx","packages/browser/console-views/src/conversation.tsx","packages/browser/console-views/src/events.tsx"]
---

## Rules

Receive messages, stable identifiers, activity, and operation state from the application. Keep model SDKs, transport,
authorization, retries, and durable request identity outside the UI library. Show recorded activity and supplied
summaries; do not invent hidden reasoning, tool calls, timings, or outcomes.

Give conversation scrolling one owner. Follow appended or growing content only while the reader chooses the live
edge. Preserve the reader's anchored content when earlier history arrives, and offer an explicit return-to-latest
action after they leave that edge. Do not use a fresh array reference as a reason to reset position or focus.
Keep selection, pending activity, and message actions attached to stable identifiers.

Keep the prompt draft application-owned. Preserve native form and multiline editing behavior. Do not submit while
composition input is active or repeat a write action because a key is held. A rejected or uncertain submission must
not clear the draft. Present stop, retry, attachment, and model actions only from supplied callbacks and eligibility.

Keep confirmation controls tied to an identified pending request. Disable duplicate activation while its decision is
pending; display the application's acknowledged outcome rather than treating a click as acceptance.
Citations and source previews remain operable with keyboard and touch and expose an actual destination or supplied
source record. Context capacity distinguishes unknown usage from zero.

Announce meaningful state changes without reading every streamed token. Do not move focus when a reply grows.
Compose named AI recipes from the shared controls, content viewers, and activity parts rather than adding a separate
state machine for each recipe. Each recipe explains which values and commands its application owns.

## Checks

Append streamed text while following and while reading earlier content. Prepend history and confirm the same anchored
message remains visible. Use return-to-latest, then update equivalent records without resetting scroll or selection.

Exercise composition input, multiline entry, held Enter, a rejected submission, and an uncertain retry. Confirm the
draft and application request identity survive as their owners require. Activate approval and source controls by
keyboard and touch, then inspect pending, denied, and completed states.

Review examples against their supplied records: can every displayed tool step, summary, and status be traced to an
input? Catalog examples use fixed synthetic data. Temporary browser probes verify behavior; existing test-curation
rules govern retained assertions.

## Local adaptations

Each mech has one public Console conversation. Only operator submissions and explicit `console_message` publications
appear in it. Private model text, native tool activity, incoming integration notifications, and activation termination
belong to Activity and authorized trace inspection. Do not manufacture an assistant reply from a completed activation.
Historical source messages remain readable in Activity and run traces, without a separate session UI.

Scope the draft and submission identity to the admitted workspace and mech. Conversation URL aliases reach that same
draft. Retain a bounded set of conversation owners across mech and run navigation. Eviction cancels their reads; workspace
or principal disposal clears protected content and rejects late completions. Cache recovery preserves the conversation
owner, draft, and acknowledged submissions while future reads use the current admitted data runtime.

The conversation owner merges authorized public history by stable message identity. Its requested page and refresh
lifecycle use the data owner's Query observers. It retains the public transcript in memory, outside the persistent
canonical record cache. A history response started before a send cannot erase its newer receipt or clear a later draft.
Refresh after acknowledged commands through the existing read owner; do not add a second polling loop to a view.

A submission receipt confirms durable notification acceptance, not reading, a new activation, a promised reply, or task
completion. Show only progress supported by recorded mailbox and activation evidence. Multiple notifications may share
an activation; opening another source does not switch the mech's identity or create an independent model owner.
Keep current activity beside the composer, independent of the transcript's history page. An unavailable activity read
must not imply idleness or reverse an acknowledged submission.

Preserve reader position and draft state while inspecting Activity, Environment, or a full-page run trace. Supply saved
history position before the first ready paint. A supplied offset starts in reading mode and applies once, so content
arrival does not override it. TanStack Router owns history positions; Elements accepts an offset without routing logic.
Scope scrolling identity to the admitted principal, workspace, mech, and history page.

Reserve the viewport and composer in the initial pending layout. Loading and ready use the same flex and scroll owners.
A transcript or activity refresh cannot unmount authorized controls, reset submission, or replace usable content.
Activity loading follows contract 071 without delaying an acknowledged send or failure.

Inspect a run while reading older content and while a send is pending. Return before and after settlement and confirm
one submission, the same anchor, and the preserved draft. Switch mechs and return with warm and delayed history. Repeat
from an earlier page and after reload. Confirm restored reading mode differs from following mode when content appends.

Finish quiet and tool-only activations and verify neither appears as a public assistant message. Publish a Console
message explicitly, refresh history, and verify one copy. Fail activity and history reads before and after admission;
confirm independently known receipts and current composer state remain intact. Reject admission after a scope change
and verify no prior transcript or late callback becomes visible.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

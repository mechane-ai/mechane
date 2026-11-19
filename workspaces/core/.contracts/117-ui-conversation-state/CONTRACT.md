---
name: ui-conversation-state
message: Preserve the reader's position and the author's draft while presenting supplied messages and activity.
paths: ["packages/browser/elements/packages/ai/**","packages/browser/console/src/drafts.tsx","packages/browser/console/src/screens/managed-session.tsx","packages/browser/console/src/managed-reads.ts","packages/browser/console-views/src/managed/**","packages/browser/console-views/src/events.tsx"]
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

Present Bash activity with the shared command disclosure and command-details body. Keep the recorded input inspectable
beside its output, including after settlement. Preserve disclosure state while its supplied content changes.
Place overall reply progress after activity, outside command triggers, with one progress owner.

Keep the pending reply line on the same typography and baseline as prose. Reserve chat response actions before text
arrives so the first token does not introduce a new action row or collapse the pending line.

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

Each Managed Agents session has its own conversation. Render documented user and agent events, with tool activity
attributed to the correct thread. Keep native model context and operator-only diagnostics in authorized trace views.
Reading a session never changes which session is executing.

Scope drafts, submitted text, event cursors, and reader positions to the admitted principal, installation, agent,
session, and thread. Preserve the draft during navigation and cache recovery. Disposal cancels reads; a revoked
session cannot reveal earlier events. Keep tabs and workspaces independent.

Read session and thread history through the data owner's observers, using stable event IDs. A failed or uncertain
send preserves the draft for explicit retry. An acknowledged send must never clear edits typed while the server
was accepting the previous text. Refresh through the existing observer after acknowledgement.

Show acceptance as acceptance of a session event. Attribute a tool confirmation to its actual tool event ID.
Read the latest status event to determine whether that session needs action. The private scheduler owns the
`Working now` and `Waiting for agent` labels. Browsing a different session never grants that session the slot.

Restore the saved reader position before rendering a ready session when the user returns through browser history.
TanStack Router owns the saved position; Elements accepts the offset. A link to a processed event selects its
stable event ID and timestamp cutoff. Preserve its original session and offer a return to the live conversation.

Reserve the viewport and composer in the initial pending layout. Loading and ready use the same flex and scroll owners.
A transcript or activity refresh cannot unmount authorized controls, reset submission, or replace usable content.
Activity loading follows contract 071 without delaying an acknowledged send or failure.

Inspect a run while reading older content and while a send is pending. Return before and after settlement and confirm
one submission, the same anchor, and the preserved draft. Switch mechs and return with warm and delayed history. Repeat
from an earlier page and after reload. Confirm restored reading mode differs from following mode when content appends.

Finish a tool-only step and verify its tool event remains distinct from a textual reply. Reconnect and read history
concurrently, then verify one copy of each durable event by ID. Switch between two sessions during refresh and
confirm that their drafts and replies remain independent. Revoke access and ensure stale callbacks reveal no content.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

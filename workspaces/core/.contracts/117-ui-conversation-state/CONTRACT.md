---
name: ui-conversation-state
message: Preserve the reader's position and the author's draft while presenting supplied messages and activity.
paths: ["packages/browser/elements/packages/ai/**","packages/browser/console/src/screens/mech.tsx","packages/browser/console/src/screens/message.tsx","packages/browser/console/src/screens/conversation.tsx","packages/browser/console/src/screens/conversation-activity.tsx","packages/browser/console-views/src/conversation.tsx","packages/browser/console-views/src/events.tsx"]
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

The Console retains the conversation and submission lifecycle while a reader inspects a run or another view of the
same mech. Hiding and revealing the conversation must not change whether the reader follows the live edge. A send
acknowledgement settles the identified submission even while its form is hidden. It clears only that submitted draft;
a rejected or uncertain send preserves the text and request identity. Switching the owning mech or workspace keeps
state from appearing in another record.

Keep current activity beside the composer, outside the paginated transcript. Its resource lifetime follows the mech,
not the history page. The compact presentation preserves the read states required by contract 071; an unavailable or
pending activity read must not imply that the mech is idle.

Reserve the conversation viewport and composer in the initial pending layout. Loading and ready use the same flex and
scroll owners; placeholder arrival must not move the composer. Once authorized controls exist, a transcript or activity
refresh cannot unmount the form, restart its submission lifecycle, or replace usable conversation content. Activity
loading follows the shared resource boundary without delaying a send acknowledgement or failure.

A message receipt acknowledges acceptance, not execution. Distinguish a message waiting to run from a recorded running
turn, and associate it only through its recorded input identity. Once that association is known, the run falling outside
a bounded page must not make the message appear queued again. Preserve independently known receipt information when
the activity read fails.

Inspect a run while reading older content and while a send is pending, then return before and after completion.
Confirm the same message and draft state return without a duplicate send or a jump to the latest message.
Observe a receipt before its run starts, while another run is active, and while the mech is paused. Change the history
page and fail the activity read before and after a successful result. Confirm current activity remains reachable beside
the composer and that missing page data does not reverse a known message outcome.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

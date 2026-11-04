---
name: ui-conversation-state
message: Preserve the reader's position and the author's draft while presenting supplied messages and activity.
paths: ["packages/browser/elements/packages/ai/**","packages/browser/console/src/screens/message.tsx","packages/browser/console-views/src/events.tsx"]
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

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

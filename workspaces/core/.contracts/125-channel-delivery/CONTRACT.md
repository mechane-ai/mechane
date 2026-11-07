---
name: channel-delivery
message: Admit verified channel messages durably and render replies with native Chat SDK semantics.
paths: ["packages/node/runtime/src/channels/**", "packages/node/runtime/src/store/channels/**", "packages/node/server/src/channels/**", "packages/shared/protocol/src/operations/slack/**"]
---

## Rules

Chat SDK owns Slack message parsing, platform formatting, cards, and platform state. Use the published Slack adapter
and Postgres state adapter. The application owns verified binding policy, durable input admission, and delivery
receipts; an SDK in-memory callback or dedup marker is not an acceptance receipt.

Verify the raw signed Slack body and timestamp before reading its actor or destination. Bind requester identity to
stable workspace and user IDs. Current installation, channel, allowed-user, bot/edit, and reply policies gate work.
A display name, message text, attachment, or model-generated field grants no authority.

Acknowledge intake only after durable admission and native workflow start or an explicit refusal. Repeated source
events retain their original input identity. Keep intake acknowledgement and terminal reply identities distinct, so
one cannot suppress the other. Refused or canceled work gives a useful, secret-free result in its original thread.

Use Chat SDK formatting for text and native card rendering for validated structured output. Raw CommonMark must not
be copied into Slack's incompatible message-text field. Preserve readable fallback text for notifications and clients
that cannot render the card. Empty or invalid structured output has a visible fallback, not a blank success.

Persist stable outbound delivery identity and reconcile an uncertain platform response before sending again.
Recheck current destination policy on retry. Rendering or delivery failure cannot rerun the completed agent task.
Bind actions to server-known resource identities and existing authority; a rendered button does not authorize an action.

Keep attachment metadata with the admitted input. Bound aggregate input bytes and individual downloads. Private Slack
file tokens remain in the trusted downloader, which checks the configured host, type, size, and redirect policy.
Unavailable files preserve the caption and yield an explicit explanation.

## Checks

Use signed local Slack requests through the actual adapter and durable admission boundary. Repeat requests around a
process restart and verify one accepted run. Exercise refused senders and unsupported attachment-only input.

Send SDK-rendered bold text, links, and a structured card through a real platform qualification. Lose the first post
response, then recover its receipt without another visible reply. Change a binding before retry and confirm its
current policy wins. Keep native SDK parser/renderer behavior in the SDK; retain product tests for lost or repeated work.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `slack-platform-owner` (125): enforced: Use the channel owner for Slack operations, such as `runtime/src/channels`

<!-- End of the generated block. -->

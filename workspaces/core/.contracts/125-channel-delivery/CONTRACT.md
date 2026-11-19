---
name: channel-delivery
message: Route authenticated events to their session and address external publications through explicit tools.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/shared/protocol/src/operations/notifications/**"]
---

## Rules

Keep platform verification, subscriptions, parsing, formatting, attachments, and delivery receipts in the integration
owner. Mechane accepts session events. Chat SDK platform adapters belong with the provider integration.
A platform event is not a privileged model instruction. Installation policy decides which verified events to deliver.

Authenticate the application before admitting events to its agent session. Verify current authority to the session
and thread at the receiving boundary. Verify provider signatures at the integration that accepts provider webhooks.
Body metadata, session creator attribution and tool result text cannot confer authority.

Persist accepted input before acknowledging it. The session event ID records admission. A lost response to an
ordinary user message may leave delivery uncertain. Keep provider delivery identity and reconciliation with its owner.

Publish visible assistant messages as session events. Keep internal reasoning and operator-only diagnostics separate.
Every Slack reply, reaction, GitHub write or other external publication requires an explicit authorized tool call
addressed to a destination. Receiving input, finishing a turn or observing an approval never performs that action.

Keep output authorization and uncertain-delivery reconciliation with the tool's owning service. Use stable operation
identities for repeated calls. A delivery failure cannot rerun completed application work. Current destination policy
still governs retry, and a rendered button or remembered destination cannot grant authority.

## Checks

Send events with different credentials, sessions and call IDs. Verify authorized admission, denial without protected
input, and independent replay after a disconnect. Require zero platform posts for an ordinary agent message or
session status change. Exercise one explicit channel tool call and reconcile its receipt after a lost response.

Run the generated dependency boundaries from the product workspace. Platform adapters cannot enter runtime, server, or
browser source through a new helper. Review the send callsites for implicit destinations and lifecycle-triggered output.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `notification-integration-boundary` (125): enforced: Move platform adapters into the external notification producer, such as `createSlackAdapter` in Nexus

<!-- End of the generated block. -->

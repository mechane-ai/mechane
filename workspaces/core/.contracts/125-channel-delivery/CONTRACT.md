---
name: channel-delivery
message: Authenticate generic notification producers and keep conversational output in explicit addressed agent tools.
paths: ["packages/worker/runtime/**", "packages/worker/server/**", "packages/shared/protocol/src/operations/notifications/**"]
---

## Rules

Keep platform verification, subscriptions, parsing, formatting, attachments, and delivery receipts in the integration
owner. Mechane accepts generic notifications; it neither hosts Slack handlers nor imports Chat SDK platform adapters.
A platform event is not a privileged model instruction. Installation policy decides which verified events to deliver.

Authenticate a service producer from deployment configuration, separately from notification metadata. Bind each
credential to explicit workspace and mech recipients. Verify the raw payload, freshness, request pathname, and signature
before trusting its content. A body field cannot supply authenticated producer identity, recipient authority, or a reply
credential. Member-authenticated admission uses the ordinary current workspace authority boundary.

Use the producer's stable notification identity for idempotency. Persist validated content, source metadata, authenticated
producer identity, and wake intent before returning acceptance. Identical retry returns the same receipt; changed input
under an existing identity fails. Transport acknowledgement says only that the notification was accepted. It is not a
promise that the mech has read it, started work, chosen to respond, or completed the request.

Make every outward conversation write an explicit agent tool call with a destination. The Console communication tool
names the current mech's public conversation by its invocation scope. Platform tools name their channel or thread through
the configured CLI or MCP interface. No intake, end-of-turn, approval, cancellation, or failure callback sends a message
or reaction. Prompt guidance may recommend acknowledgment; scheduling must not perform it.

Keep output authorization and uncertain-delivery reconciliation with the tool's owning service. Use stable operation
identities for repeated calls. A delivery failure cannot rerun completed application work. Current destination policy
still governs retry, and a rendered button or remembered destination cannot grant authority.

## Checks

Send signed notifications through the packaged HTTP route. Exercise a valid producer, stale timestamp, altered body,
altered pathname, unknown producer, foreign recipient, identical retry, and changed duplicate. Verify durable admission
before success, no protected input on refusal, and recovery after a lost acknowledgment or host replacement.

Observe all lifecycle outcomes without a communication tool call and require zero platform posts or reactions. Then
invoke the explicit Console tool twice with one stable identity and confirm one public message. Qualify platform CLI
formatting and receipt recovery in the owning integration, not by duplicating its SDK checks here.

Run the generated dependency boundaries from the product workspace. Platform adapters cannot enter runtime, server, or
browser source through a new helper. Review the send callsites for implicit destinations and lifecycle-triggered output.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `notification-integration-boundary` (125): enforced: Move platform adapters into the external notification producer, such as `createSlackAdapter` in Nexus

<!-- End of the generated block. -->

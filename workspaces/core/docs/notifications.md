# Notify a mech

A notification is durable input to a persistent mech. It can report a person's message, an external decision, or a
background result. The mech incorporates notifications at model decision boundaries and chooses what to do next.
Acceptance does not promise a new task, an immediate reply, or a completed action.

## Send input

An admitted workspace member can use the CLI:

```sh
mechane notification send MECH_ID 'Please inspect the latest deployment' --notification-id REQUEST_UUID
```

Keep the request UUID when retrying an uncertain send. Identical input returns its original receipt; changed content
under that identity fails. The receipt records accepted sequence and time. Source metadata describes input; it does not
authorize an operation. The [operation catalog](../packages/shared/protocol/src/catalog.ts) and
[notification schemas](../packages/shared/protocol/src/operations/notifications/schemas.ts) own the current wire shape.

Console submissions use this same inbox. Each mech has one public Console conversation. Operator messages appear there,
and the agent can publish a reply through `console_message`. Private model output and quiet completion remain execution
activity rather than public chat messages.

## Service producers

Configure producer IDs, secret-binding names, and explicit workspace/mech recipients in the Worker's
`MECHANE_NOTIFICATION_PRODUCERS` setting. Resolve each `secretBinding` through a deployment secret reference; the
configuration contains no signing-secret value. The [runtime configuration](../packages/worker/runtime/src/config.ts)
owns the schema. Models and notification payloads cannot add recipients or select credentials.

A producer sends the generic endpoint:

```text
POST /api/v1/workspaces/:workspace_id/mechs/:mech_id/notifications/:notification_id
```

The JSON body contains text, source metadata, and optional structured correlation data. The producer supplies these
headers:

| Header                     | Value                               |
| -------------------------- | ----------------------------------- |
| `x-notification-producer`  | Configured producer ID              |
| `x-notification-timestamp` | Current Unix time in seconds        |
| `x-notification-signature` | Lowercase hex HMAC-SHA256 signature |

Sign the exact UTF-8 string `${timestamp}.${pathname}.${rawBody}` using the producer's resolved secret. The timestamp
must be within five minutes. Sign the encoded pathname and exact body bytes; reserializing after signing changes the
signature. Retry with the same notification ID and content, using a fresh timestamp and signature when needed.
Authenticated producer identity remains separate from body metadata.

The receiver checks producer authority and commits actor admission before returning acceptance. The integration owns its
durable outgoing retry and correlation. A webhook handler's in-memory completion is not an acceptance receipt. Keep
credentials out of text, source metadata, and correlation data.

## Responses and decisions

The agent sends responses through explicit tools. A Slack integration supplies reading, posting, and reaction tools
through its CLI or MCP service. Mechane adds no automatic reactions or lifecycle posts. A final model answer is private
execution context until an explicit tool publishes it.

The application owns an approval request and may execute the approved operation itself. Its later notification names the
request and outcome. Read the current authority and original receipt before a fresh operation; an integration receipt
may already establish completed work.

Use the original correlation and explicit destination when following up. Another notification can arrive from a
different thread before the decision. Source correlation does not select a different live agent or an implicit reply
channel.

## Observe and recover

Pi owns native conversation, model and tool progression, compaction, and recovery. The Mech actor owns immutable
notifications, observed-input coverage, effect fences, and explicit publications. Its alarm reconciles native work,
future notifications, and receipts. Postgres owns current shared authority and accounting.

One activation can consume several notifications. Native traces record actor execution; imported traces retain their
historical provenance without replaying effects. Notes and long-term memory are ordinary durable home files.

A newer unobserved notification can produce `not_started` before a fresh tool effect. The generation then observes
current input and chooses again. An already-admitted effect keeps its original receipt; new input cannot erase or repeat
it. Inspect uncertain receipts and the external system before retrying consequential work.

The [agent environment guide](agent-environments.md) describes files, credentials, tools, and machine lifetime. The
[operations guide](operations.md) covers recovery and deployment without resetting persistent identity.

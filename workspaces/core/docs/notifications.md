# Notify a mech

A notification is durable input to a persistent mech. It can report a person's message, an external decision, or a
background result. The mech incorporates notifications at model decision boundaries and chooses what to do next.
Acceptance does not promise a new task, an immediate reply, or a completed action.

## Send input

An admitted workspace member can use the CLI:

```sh
mechane notification send --mech-id MECH_ID --text 'Please inspect the latest deployment' --notification-id REQUEST_UUID
```

Keep the request UUID when retrying an uncertain send. Identical input returns its original receipt; changed content
under that identity fails. The receipt records accepted sequence and time. Its source is descriptive metadata, not
permission to perform an operation. The [operation catalog](../packages/shared/protocol/src/catalog.ts) and
[notification schemas](../packages/shared/protocol/src/operations/notifications/schemas.ts) own the current wire shape.

Console submissions use this same inbox. Each mech has one public Console conversation. Operator messages appear there,
and the agent can publish a reply through `console_message`. Private model output and quiet completion remain execution
activity rather than public chat messages.

## Service producers

Configure service producers in the Node deployment's `MECHANE_NOTIFICATION_PRODUCERS` setting. Each entry has a producer
ID, a secret, and explicit workspace/mech recipients. Keep the configuration in the deployment secret store. Models and
notification payloads cannot add recipients or select credentials.

A producer sends the generic endpoint:

```text
POST /api/v1/workspaces/:workspace_id/mechs/:mech_id/notifications/:notification_id
```

The JSON body contains text, source metadata, and optional structured correlation data. The producer supplies these
headers:

| Header                     | Value                        |
| -------------------------- | ---------------------------- |
| `x-notification-producer`  | Configured producer ID       |
| `x-notification-timestamp` | Current Unix time in seconds |
| `x-notification-signature` | Hex HMAC-SHA256 signature    |

Sign the exact UTF-8 string `${timestamp}.${pathname}.${rawBody}` using the producer's configured secret. The timestamp
must be within five minutes. Sign the encoded request pathname and exact body bytes; reserializing after signing changes
the signature. Retry with the same notification ID and content, using a fresh timestamp and signature when needed.
Authenticated producer identity is recorded separately from body metadata.

The receiver verifies producer authority and persists the notification and wake intent before returning acceptance. The
integration owns its durable outgoing retry and correlation. A webhook handler's in-memory completion is not an
acceptance receipt. Do not put credentials in text, source metadata, or correlation data.

## Responses and decisions

The agent sends responses through explicit tools. A Slack integration supplies ordinary reading, posting, and reaction
tools through its CLI or MCP service. Its prompt can recommend acknowledging a message with eyes. Mechane does not add
reactions or lifecycle notices automatically, and a final model answer is not a platform send.

An approval request belongs to the application that grants access. It returns a stable request reference; its eventual
decision becomes a notification. The mech can handle other work while waiting. A ready decision is a cue to inspect the
request and current authority before a fresh operation. It is not evidence that the operation happened.

Use the original correlation and explicit destination when following up. Another notification can arrive from a
different thread before the decision. There is no implicit current reply channel to redirect the response.

## Observe and recover

Activity shows received notifications and execution evidence. Activations are bounded native Workflow lifetimes; one
activation may consume several notifications. Their traces describe model and tool work, including a quiet completion.
The working context keeps a bounded private summary and recent messages, while activation traces retain execution
evidence. A delayed checkpoint cannot overwrite later context. The durable wake reconciler handles a missed immediate
start after a service interruption.

Before an unstarted tool effect, a newer notification can cause a `not_started` result. The native model loop then sees
current context and chooses again. An already-admitted effect keeps its original receipt; a new message cannot erase or
automatically repeat it. Inspect uncertain receipts and the external system before retrying consequential work.

The [agent environment guide](agent-environments.md) describes files, credentials, tools, and machine lifetime. The
[operations guide](operations.md) covers service recovery and deployment without resetting persistent identity.

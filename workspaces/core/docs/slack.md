# Connect Slack

A workspace owner binds an existing Slack app and channel to a mech. Verified human messages become durable inputs.
Replies retain the originating thread while the mech uses its own memory and developer environment. Binding a channel
does not replace the app's existing DM behavior or route unrelated channels to the mech.

## Installation

The bot needs the Slack permissions for the selected channel type and reply operations. Configure the relevant message
or mention subscriptions and invite the existing bot to the channel. Attachment reading requires file access. Add only
scopes the installation needs; Slack's [Events API guide](https://docs.slack.dev/apis/events-api/) owns the current
scope and subscription reference.

Select the Mechane workspace, save each credential in a private file, and upload it through an owner's login:

```sh
mechane credential put slack-signing --file /private/path/slack-signing
mechane credential put slack-bot --file /private/path/slack-bot
mechane slack connect team-chat \
  --team-id SLACK_TEAM_ID --bot-user-id SLACK_BOT_USER_ID \
  --signing-secret-reference slack-signing --bot-token-secret-reference slack-bot
mechane slack connections
```

Installation records contain references; the workspace vault encrypts the values. The signing secret authenticates the
raw event body. Bot and optional history credentials stay in the trusted adapter, outside model context and guests. Use
the configured Slack API origin; production credentials must never reach a caller-selected host.

## Bind a channel

Keep a stable binding UUID when updating the audience or policy:

```sh
mechane slack bind MECH_UUID \
  --binding-id BINDING_UUID --connection-id team-chat \
  --team-id SLACK_TEAM_ID --channel-id SLACK_CHANNEL_ID \
  --listening true --replies true --allowed-user-ids '["SLACK_USER_ID"]'
mechane slack bindings
mechane slack deliveries MECH_UUID
```

Use the returned Events API URL in Slack. The server verifies the timestamp and signature before it trusts actor,
workspace, or channel identifiers. An allowed-user list compares stable verified user IDs. Display names, quoted
messages, and attachments cannot supply authority.

The endpoint acknowledges only after durable admission and workflow start or a useful refusal. Repeated events use the
same source identity. Bot messages, edits, and unbound audiences do not start work. The domain queue serializes a mech's
executions; Chat's handler lifetime is not the execution queue.

Text captions remain useful when an attachment cannot be read. Downloads have size, type, host, and time bounds. Private
file tokens never become model input. Unsupported file-only input receives an explanation instead of an empty agent
request.

## Replies

Chat SDK renders text with Slack's formatting and link rules. Structured output uses the shared json-render catalog,
with native cards for Slack and Mechane Elements in the Console. Each structured message retains readable fallback text.
An invalid or unsupported card cannot turn a completed answer into a blank message.

Intake notices and terminal replies have separate durable identities. The runtime rechecks installation and binding
policy before delivery. A temporary posting failure never reruns the agent task. An uncertain post is reconciled using
its bot and delivery identity before another send; unreadable history is not proof that the post failed.

Inspect delivery receipts with the CLI or Console when Slack does not show the expected result. Preserve the original
input and delivery IDs while investigating. Changing a binding or token does not grant permission to redirect an old
reply to a new audience.

## Approvals

Nexus owns access policy, approval cards, and its browser approval page. Mechane submits a request with trusted
attribution from the originating input, then waits through a native Workflow hook. An authenticated Nexus event wakes
the original work automatically. The runtime rechecks the request before using access and replies in the original
thread. The same workflow can survive a service restart while waiting.

Approving access permits an operation to continue; it does not mean the requested change was completed. The agent must
still verify the external result before reporting success.

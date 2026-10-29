# Connect an existing Slack app

A workspace owner can bind an existing Slack channel to one agent. Human messages enter its durable inbox; successful
answers return to the original thread. There is no history import. Use a dedicated agent for each channel because its
conversation and memory persist across messages.

## Installation

Reuse your app, bot identity and channel membership. Its token needs `chat:write`; event subscriptions and history
access need the scopes for the channel type, such as `channels:history` or `groups:history`. Subscribe to `app_mention`
and/or the relevant message events. Add scopes and authorize them only when the existing installation lacks them.
[Slack's Events API](https://docs.slack.dev/apis/events-api/)

Configure `MECHANE_SLACK_INSTALLATIONS` as a JSON array following the
[installation schema](../packages/shared/deployment/src/slack.schemas.ts). This abbreviated example shows one record:

```json
{
  "id": "team-chat",
  "workspaceId": "YOUR-MECHANE-WORKSPACE-UUID",
  "teamId": "YOUR-SLACK-TEAM-ID",
  "botUserId": "YOUR-SLACK-BOT-USER-ID",
  "apiOrigin": "https://slack.com",
  "signingSecretReference": "slack-signing",
  "botTokenSecretReference": "slack-bot",
  "historyTokenSecretReference": "slack-history"
}
```

Store the signing secret and tokens in the server-only `MECHANE_INTEGRATION_SECRETS` secret: a JSON object keyed first
by Mechane workspace UUID, then by secret reference. Installation metadata contains references only. The optional
history reference falls back to the bot token. Choose a credential that can read the bound conversation and message
metadata with [conversations.replies](https://docs.slack.dev/reference/methods/conversations.replies/). See
[self-hosting](self-hosting.md#supply-credentials) for uploading secrets. Neither prompts nor guest machines receive the
credentials.

## Bind a channel

Create an agent, then run this with a workspace owner's CLI credentials. Choose a UUID for the binding and retain it for
later updates:

```sh
mechane slack bind MECH-UUID \
  --binding-id BINDING-UUID --connection-id team-chat \
  --team-id SLACK-TEAM-ID --channel-id SLACK-CHANNEL-ID \
  --listening true --replies true
mechane slack bindings
mechane slack deliveries MECH-UUID
```

`slack bind` prints the Events API request URL. Set it in the existing app's Event Subscriptions. URL verification is
signed, and the event endpoint authenticates the exact body with Slack's timestamped signature before reading it.
[Slack request verification](https://docs.slack.dev/authentication/verifying-requests-from-slack/)

A binding keeps its original agent, team and channel. Reuse its UUID and audience to change `--listening` or
`--replies`. Only one channel binds to an agent, and only one agent binds to a channel per installation. Bot messages,
the app's own messages, message edits and unbound audiences are ignored. Duplicate events and duplicate mention/message
subscriptions reuse the same admitted inbox item. The endpoint acknowledges after durable admission, before model work.

## Delivery receipts

Replies use the original thread timestamp and a durable delivery identifier. Their text is limited to 39,000 characters.
Watch notifications use the same outbox and post to the configured channel.
[Slack threaded messages](https://docs.slack.dev/reference/methods/chat.postMessage/)

Receipts are `pending`, `uncertain`, `sent` or `blocked`. An ambiguous network or provider response becomes `uncertain`.
Reconciliation looks for this bot's delivery metadata and content digest in Slack history. Positive evidence marks it
sent; absent or inaccessible history never triggers a blind repost. This does not promise exactly-once delivery.

Recovery first checks after 15 seconds, then every five minutes, stopping after 12 checks. Rate-limited posts remain
pending until the provider's retry deadline. `slack deliveries` shows the latest receipts and reasons; use
`--output json` for routing and deadline details. Disabled bindings block pending deliveries. Re-enabling a binding does
not automatically retry a blocked receipt. An uncertain receipt without another deadline needs operator review in Slack.

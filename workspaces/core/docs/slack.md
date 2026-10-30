# Connect an existing Slack app

A workspace owner can bind an existing Slack channel to one agent. Human messages enter its durable inbox; successful
answers return to the original thread. There is no history import. Use a dedicated agent for each channel because its
conversation and memory persist across messages.

## Installation

Reuse your app, bot identity and channel membership. Its token needs `chat:write`; event subscriptions and history
access need the scopes for the channel type, such as `channels:history` or `groups:history`. Subscribe to `app_mention`
and/or the relevant message events. Add scopes and authorize them only when the existing installation lacks them.
[Slack's Events API](https://docs.slack.dev/apis/events-api/)

Select the workspace with `--workspace UUID` or `MECHANE_WORKSPACE_ID`. Save each credential in a private file, then
upload it with the workspace owner's CLI login:

```sh
mechane credential put slack-signing --file /private/path/slack-signing
mechane credential put slack-bot --file /private/path/slack-bot
mechane slack connect team-chat \
  --team-id SLACK-TEAM-ID --bot-user-id SLACK-BOT-USER-ID \
  --signing-secret-reference slack-signing --bot-token-secret-reference slack-bot
mechane slack connections
```

The service encrypts credentials in workspace storage. Installation metadata contains references only; neither prompts
nor guest machines receive their values. Updating credentials or Slack connections takes effect without a deployment.
`credential list` returns metadata, and `credential delete REFERENCE` removes a held credential.

The optional `--history-token-secret-reference` falls back to the bot token. Choose a credential that can read the bound
conversation and message metadata with
[conversations.replies](https://docs.slack.dev/reference/methods/conversations.replies/). Use `slack connect` with the
same connection ID to replace metadata. `slack disconnect CONNECTION-ID` disables the connection while retaining
bindings and delivery history. Subsequent callbacks and deliveries check the current record.

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

The URL stays `/integrations/slack/WORKSPACE-UUID/CONNECTION-ID/events` when credentials or connection metadata change.

A binding keeps its original agent, team and channel. Reuse its UUID and audience to change `--listening` or
`--replies`. Only one channel binds to an agent, and only one agent binds to a channel per installation. Bot messages,
the app's own messages, message edits and unbound audiences are ignored. Duplicate events and duplicate mention/message
subscriptions reuse the same admitted inbox item. The endpoint acknowledges after durable admission, before model work.

## Import existing configuration

Prepare an ignored file with mode `0600`, replacing the example IDs and credential placeholders below. Preserve the
existing workspace UUID, connection ID, and secret references so callbacks and bindings keep their identity.

```json
{
  "credentials": { "slack-signing": "REPLACE_WITH_SIGNING_SECRET", "slack-bot": "REPLACE_WITH_BOT_TOKEN" },
  "slack_installations": [
    {
      "id": "team-chat",
      "workspace_id": "00000000-0000-4000-8000-000000000001",
      "team_id": "T12345",
      "bot_user_id": "U12345",
      "signing_secret_reference": "slack-signing",
      "bot_token_secret_reference": "slack-bot",
      "api_origin": "https://slack.com"
    }
  ],
  "policy": { "suspended": false, "sandboxes": true, "machines": 2, "daily_allowance_micros": 5000000 }
}
```

Run `mechane --workspace WORKSPACE-UUID workspace import --file /private/path/runtime-import.json` once after pausing
the agents that use these connections. This operator action creates missing records; ordinary deployments never import
or replace workspace data. `credentials` and `slack_installations` are required; use `{}` and `[]` when empty. Omit
`history_token_secret_reference` to reuse the bot token; an included value must be a reference string.

Omit `policy` to retain the existing policy. Including it requires an installation administrator, checked before any
writes. An already stored policy or Slack installation must match. Existing credentials remain unchanged and are
reported as retained without comparing their values. A failed import can leave earlier records created; retrying resumes
safely. An imported suspension must be explicitly lifted before subsequent member operations.

See the [import schema](../packages/node/cli/src/runs/workspace-import/schemas.ts) and
[Slack installation schema](../packages/shared/protocol/src/operations/slack/installations.schemas.ts) for the current
format. The import never changes agents, sandbox files, grants, bindings, or delivery history.

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

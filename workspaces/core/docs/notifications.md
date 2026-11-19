# Work in an agent session

A session holds one conversation with an agent in a selected environment. Use its ID for follow-ups, tool confirmations,
and history. An agent can have several sessions. A message in one session belongs to that session even while another is
running.

## Start a conversation

Configure your [installation credentials](self-hosting.md#use). Choose an agent ID from `ant beta:agents list` and an
environment ID from `ant beta:environments list`. Save them as `AGENT_ID` and `ENVIRONMENT_ID` in your shell.

```sh
SESSION_ID="$(ant --raw-output --transform id beta:sessions create \
  --agent "$AGENT_ID" --environment-id "$ENVIRONMENT_ID")"
ant beta:sessions connect "$SESSION_ID"
```

The terminal shows the conversation and provides input and tool approval controls. Reconnect with the same command after
closing the terminal. Create a separate session to start independent work.

Send an event from a script and inspect its recorded history:

```sh
ant beta:sessions:events send --session-id "$SESSION_ID" \
  --event '{"type":"user.message","content":[{"type":"text","text":"Inspect the latest deployment."}]}'
ant beta:sessions:events list --session-id "$SESSION_ID"
```

An accepted event can be waiting for processing. A session that needs a tool result or permission can be idle. Use the
event history to distinguish a reply, a pending call and an interruption.
[Anthropic session events](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)

## Route an external trigger

Map each source conversation or work item to its installation and session. Keep the mapping in the application that
receives the webhook or timer. Delivery retries need a stable source identity there. The public event-send API assigns
event IDs on the server. Reconcile a lost response against history before sending again; repeating a user message can
start more work.

Send an approval or tool result to the session and event ID that requested it. Keep Slack posts, reactions, GitHub
writes and business approvals in their respective tools. A reply in the session is visible to its clients. Publishing
that reply to an external channel requires a separate tool call.

A recurring task can create a session on each tick or post to an existing work session. The scheduler owns the cadence
and duplicate tick handling. Read session history and the external action's receipt before retrying a consequential
operation.

## Reconnect

A live event stream begins when you open it. Open the stream before sending input. To reconnect, open a new stream, list
the retained history and skip events whose IDs you have already processed. Keep a separate cursor and set of seen events
for each session or thread.

The [environment guide](agent-environments.md) covers files and tools. The [operations guide](operations.md) covers
installation recovery.

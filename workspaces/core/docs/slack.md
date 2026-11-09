# Slack through an integration

Slack access belongs to the installation's integration service. In Softmax, Nexus verifies Slack events, selects the
configured mech recipient, and sends a generic [notification](notifications.md). The mech then uses Nexus CLI or MCP
tools to read the thread, react, post, or request application access.

Mechane has no Slack app, channel-binding API, signing secret, bot token, formatter, or automatic response handler. A
notification does not require a reply. The agent's instructions can ask it to acknowledge promptly, but every visible
reaction and message comes from an explicit tool call.

## Configure the integration

The integration owns the Slack app's scopes, event subscriptions, audience policy, and bot membership. It verifies raw
Slack signatures and stable actor identity before selecting a recipient. Its notification producer credential is bound
to explicit Mechane workspace and mech IDs. The installation owner supplies that credential and the agent's application
CLI configuration without putting platform secrets into notification content.

Keep a dedicated coding channel separate from an existing Factory DM. Configuring one recipient does not grant
permission to replace another bot's DM behavior. Follow the integration's maintained configuration and Slack's
[Events API reference](https://docs.slack.dev/apis/events-api/) for its actual subscription requirements.

## Follow the message

The integration keeps the platform event identity and thread correlation in the admitted notification. The agent reads
current thread context through its tools and chooses an explicitly addressed reply. Intervening notifications do not
change that destination. Normal final model text remains private execution context.

The posting tool owns Slack formatting, current destination authority, a stable operation identity, and reconciliation
after a lost response. Its receipt distinguishes delivered, refused, and uncertain outcomes. A failed post never means
the underlying code change should run again. Platform formatting qualification belongs to that integration.

## Access decisions

Nexus owns approval policy, notifications, grant expiry, and the browser approval page. Its request operation returns a
reference while the mech remains free to handle other input. An authenticated decision notification wakes the same mech
after approval without another human message.

The agent rechecks the request and current authority before acting. Approval does not prove the requested change
happened. The agent must inspect the external result before reporting success through its explicit Slack tool.

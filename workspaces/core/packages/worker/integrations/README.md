# Integrations

Trusted MCP, Slack and GitHub calls for Mechane. This package resolves encrypted workspace credentials only for an
authorized integration. MCP connections expose explicitly approved read-only tools that incur no external charge.

Store a credential with `mechane --workspace UUID credential put REFERENCE --file PRIVATE_FILE`. Connection records and
grants contain references and permissions; the installation's keyring remains in its secret store. A missing credential
never falls back to deployment configuration or another workspace.

Keep values out of agent instructions, sandboxes and checkpoints. Manage connections and per-agent grants through
`mechane connection` and `mechane grant`. See [remote tools](../../../docs/remote-tools.md),
[Slack](../../../docs/slack.md) and [private source](../../../docs/source.md) for the owner workflows.

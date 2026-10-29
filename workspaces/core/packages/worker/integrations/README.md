# Integrations

Trusted remote calls for Mechane. This package resolves workspace-scoped server secrets and calls MCP tools over
Streamable HTTP. Connections expose only explicitly approved read-only tools that incur no external charge.

Set `MECHANE_INTEGRATION_SECRETS` in the server secret environment as JSON keyed by workspace id, then secret reference.
Keep the values out of connection records, agent instructions, sandboxes, and checkpoints. Connection metadata and
per-agent grants are managed with `mechane connection` and `mechane grant`.

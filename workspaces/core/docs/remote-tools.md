# Remote MCP tools

A workspace owner can register a remote MCP connection and grant each mech an explicit subset of its tools. The first
release supports tools that only read data and incur no external charge. Model work still uses the workspace's normal
model budget.

## Configure a connection

Run `mechane workspace list` to find the workspace ID. Connection and grant commands act in the signed-in account's
first workspace. Every administration request checks the caller's current owner membership.

The operator supplies bearer credentials through the server-only `MECHANE_INTEGRATION_SECRETS` setting. Its JSON value
maps workspace IDs to named credential references:

```json
{ "WORKSPACE_UUID": { "nexus-reader": "BEARER_TOKEN" } }
```

Replace the placeholders and supply this value through the installation's secret configuration. For Cloudflare, use the
`secret_refs` mapping described in [self-hosting](self-hosting.md). The same reference name in another workspace
resolves only against that workspace's map. Connection records contain the reference, never the credential value.

Register the remote URL and the exact tool names you have approved. The remote URL and tool names below are
placeholders:

```sh
mechane connection create \
  --name Nexus \
  --url https://nexus.example/mcp \
  --secret-reference nexus-reader \
  --allowed-tools '["search","read_document"]' \
  --policy read_only_free
mechane connection list
```

Omit `--secret-reference` for a server that needs no authentication. URLs must use HTTPS outside loopback and cannot
contain credentials, a query, or a fragment. `connection update CONNECTION_ID` takes the same configuration flags and
replaces the configuration. `connection delete CONNECTION_ID` deletes the connection and all its grants.

## Grant tools to a mech

Replace `MECH_ID` and `CONNECTION_ID` with the IDs returned by the CLI:

```sh
mechane grant set MECH_ID CONNECTION_ID --tools '["search"]'
mechane grant list MECH_ID
mechane grant revoke MECH_ID CONNECTION_ID
```

`grant set` replaces the previous grant. Each name must already be in the connection's allowlist. Removing an allowed
tool also removes it from existing grants; adding it back requires a new grant. Forks and clones receive no grants.

The mech uses `list_remote_tools` to see its grants, then supplies a connection ID to discover permitted tool schemas.
It invokes a tool with `call_remote_tool`. These tools are available only to the mech's main conversation. The trusted
host checks the current connection and grant immediately before dispatch. Revocation prevents the next dispatch; it does
not recall a request already sent. Remote descriptions and results remain untrusted source material.

## Supported transport and limits

The client uses the official MCP SDK's explicit `legacy` protocol mode, the 2025-era `initialize` handshake, over
Streamable HTTP. This mode is distinct from the newer 2026 protocol negotiation described in the
[SDK protocol guide](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions). There is no automatic protocol or
legacy HTTP+SSE fallback, local stdio server, or OAuth flow. Authentication is an optional bearer token. Redirects and
transport reconnection retries are disabled.

Choosing `read_only_free` is the owner's approval of the listed tools' behavior and charging policy. A server's
`readOnlyHint` does not establish that approval. An explicit `false` hint additionally blocks the tool. Paid or mutating
operations remain unsupported until they have reservation and receipt handling.

Each discovery or invocation has a 30-second deadline and accepts cancellation. Arguments and returned content are
limited to 64 KiB, aggregate HTTP response bodies to 1 MiB, and discovery to eight pages. There are at most 64
connections per workspace and 64 approved names per connection. Invalid schemas, missing credentials, changed grants,
oversized responses, and failed cleanup produce explicit bounded errors. Credentials stay in server settings and are
redacted from returned content before it reaches the model.

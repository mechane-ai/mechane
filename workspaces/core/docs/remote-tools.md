# Remote MCP tools

A workspace owner can register a remote MCP connection and grant each mech an explicit subset of its tools. Connections
support tools that only read data and incur no external charge. Model work still uses the workspace's normal model
budget.

## Configure a connection

Run `mechane workspace list` to find the workspace ID, then set `MECHANE_WORKSPACE_ID` or pass `--workspace UUID` to
select it. Without a selection, commands use the personal workspace. Every administration request checks the caller's
current owner membership.

Save the bearer credential in a private file, then upload it through the runtime API:

```sh
mechane credential put knowledge-reader --file /private/path/knowledge-reader
mechane credential list
```

The service encrypts the value in workspace storage. Commands return reference names, key versions, and timestamps;
there is no API that returns the value. The same reference in another workspace resolves only within that workspace.
Connection records contain the reference, never the credential.

Repeat `credential put` to replace a value, or use `credential delete REFERENCE` to remove it. Changes affect subsequent
requests without deploying or restarting agents. Add `--create-only` when an import must refuse an existing reference.
The [workspace import workflow](slack.md#import-existing-configuration) imports credentials, Slack metadata, and
optional workspace policy while preserving existing records.

The installation supplies the encryption keyring through its secret store; local mode retains it privately. See
[self-hosting](self-hosting.md) for installation configuration. Keep older encryption keys until all credentials have
been saved under the new version. Listing credentials shows the versions still in use.

Register the remote URL and the exact tool names you have approved. The remote URL and tool names below are
placeholders:

```sh
mechane connection create \
  --name Knowledge \
  --url https://knowledge.example/mcp \
  --secret-reference knowledge-reader \
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
oversized responses, and failed cleanup produce explicit bounded errors. Only the server component sending the request
decrypts its credential, and returned content is redacted before it reaches the model.

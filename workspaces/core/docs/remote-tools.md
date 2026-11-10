# Remote MCP tools

A workspace owner registers a Model Context Protocol (MCP) connection and grants each mech an explicit set of tools. The
native MCP client discovers definitions; Mechane registers permitted schemas as Pi tools. Every fresh invocation checks
current grants, generation-observed notifications, and the actor's execution fence. A stale decision can return
`not_started` without calling the remote service.

## Configure

Select the workspace with `--workspace UUID`. Store a credential from a private file when the remote service requires
authentication:

```sh
mechane --workspace WORKSPACE_UUID credential put knowledge-reader --file /private/path/knowledge-reader
mechane --workspace WORKSPACE_UUID connection create \
  --name Knowledge \
  --url https://knowledge.example/mcp \
  --secret-reference knowledge-reader \
  --allowed-tools '["search","read_document"]' \
  --policy read_only_free
mechane --workspace WORKSPACE_UUID connection list
```

The examples use a fictional service. Omit the secret reference for a public connection. Production URLs require HTTPS
and cannot embed credentials. Connection metadata contains references; the workspace vault owns encrypted values.
Updating a reference affects later requests without exposing a value through listing or inspection.

`read_only_free` is the owner's declaration of the approved tools' behavior. A remote read-only hint does not grant
permission by itself, and an explicit mutating hint refuses the tool.

Choose `idempotent_free` to also approve free writes whose MCP metadata explicitly sets `readOnlyHint: false` and
`idempotentHint: true`. Grant only the intended operation names. A lost response can mean the write committed; inspect
the service before deciding whether another invocation is safe. Mechane retains the original uncertain receipt rather
than automatically calling again. This policy does not authorize paid or non-idempotent writes.

## Grant

```sh
mechane --workspace WORKSPACE_UUID grant set MECH_ID CONNECTION_ID --tools '["search"]'
mechane --workspace WORKSPACE_UUID grant list MECH_ID
mechane --workspace WORKSPACE_UUID grant revoke MECH_ID CONNECTION_ID
```

Each granted name must be in the connection's allowlist. The runtime loads only currently permitted definitions and
rechecks authority before dispatch. Revocation prevents a later call; it cannot recall an already-sent request.
Descriptions and results remain untrusted source material.

## Transport and recovery

The native `@ai-sdk/mcp` client owns the HTTP handshake and tool conversion. Client lifetime stays inside a trusted
operation, with explicit deadlines, bounded responses, redirect rejection, and cleanup. Postgres owns current connection
policy, grants, and encrypted credentials. Actor receipts own the effect identity and outcome; live clients and
credential headers do not enter durable conversation state.

A tool receipt distinguishes a known result from an uncertain request. A lost response does not automatically call the
remote tool again. Failed discovery tells the agent which connection could not be loaded; it must not claim those tools
are available.

The [MCP integration](../packages/worker/runtime/src/tools/mcp.ts) and its
[limits](../packages/worker/runtime/src/tools/constants.ts) own supported transport behavior. Native SDK definitions
stay upstream; Mechane owns connection policy, credential resolution, attribution, and receipts.

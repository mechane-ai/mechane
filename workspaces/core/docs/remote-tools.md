# Remote MCP tools

A workspace owner registers an MCP connection and grants each mech an explicit set of tools. The runtime discovers those
tools through the native AI SDK MCP client, then presents their native schemas to WorkflowAgent. Current grants are
checked again before every invocation. The notification watermark and active-owner fence are checked before a fresh
effect, so stale decisions can return `not_started` without calling the remote service.

## Configure

Select a workspace with `--workspace UUID` or `MECHANE_WORKSPACE_ID`. Store a credential from a private file when the
remote service requires authentication:

```sh
mechane credential put knowledge-reader --file /private/path/knowledge-reader
mechane connection create \
  --name Knowledge \
  --url https://knowledge.example/mcp \
  --secret-reference knowledge-reader \
  --allowed-tools '["search","read_document"]' \
  --policy read_only_free
mechane connection list
```

The examples use a fictional service. Omit the secret reference for a public connection. Production URLs require HTTPS
and cannot embed credentials. Connection metadata contains references; the workspace vault owns encrypted values.
Updating a reference affects later requests without exposing a value through listing or inspection.

`read_only_free` is the owner's declaration of the approved tools' behavior. A remote read-only hint does not grant
permission by itself, and an explicit mutating hint refuses the tool. Use separately authorized shell/application access
for operations outside this connection policy.

## Grant

```sh
mechane grant set MECH_ID CONNECTION_ID --tools '["search"]'
mechane grant list MECH_ID
mechane grant revoke MECH_ID CONNECTION_ID
```

Each granted name must be in the connection's allowlist. The runtime loads only currently permitted definitions and
rechecks authority before dispatch. Revocation prevents a later call; it cannot recall an already-sent request.
Descriptions and results remain untrusted source material.

## Transport and recovery

The native `@ai-sdk/mcp` client owns the HTTP handshake and tool conversion. Runtime tools keep client lifetime inside
trusted steps, with explicit deadlines, bounded responses, no credential-bearing redirects, and cleanup. They do not
persist a live MCP client or credential headers in Workflow state.

A tool call receives a stable effect identity. Its receipt distinguishes a known result from an uncertain request. A
lost response does not automatically call the remote tool again. Failed discovery tells the agent which connection could
not be loaded; it must not claim those tools are available.

The [MCP integration](../packages/node/runtime/src/tools/mcp.ts) and its
[limits](../packages/node/runtime/src/tools/constants.ts) own supported transport behavior. Native SDK definitions stay
upstream; Mechane owns connection policy, credential resolution, attribution, and receipts.

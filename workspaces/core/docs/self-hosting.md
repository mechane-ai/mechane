# Run your own Mechane

Applications use the Anthropic Managed Agents SDK or the `ant` CLI against the installation's origin. Create an agent
for the persistent identity and a session for each conversation or task. Two sessions can both receive input while the
agent works on one thread. When one thread needs a tool result or a human decision, another can run. Return the result
to the session, thread and tool call that requested it.

Each session has its own history and computer. Attach a memory store to share knowledge across sessions. Use an external
scheduler to start recurring work and tools to send replies to Slack or act on GitHub.

The installation runs a Cloudflare application Worker, Console assets, Durable Objects, a checkpoint bucket and
containers. Pi runs each thread's execution. Standard Postgres stores identities, resource definitions and grants.

### Moving an application

Set the SDK's base URL and credential. Create the agents, environments, skills, memory stores and credentials on the
destination installation and use the IDs it returns. Existing session URLs and transcripts belong to the installation
that created them. A worker needs an environment key issued by that same installation.

For portability, use the common model IDs and tools configured at both destinations. This installation supports
Anthropic Messages and OpenAI-compatible model gateways, encrypted database vaults, and server-key or OIDC client
authentication. Bedrock and Vertex credentials, external vault secret managers and host-substituted environment
variables require different operator capabilities. Check those dependencies when moving an existing deployment. The
[self-hosted feature matrix](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences) and the
[pinned SDK fixture](../packages/shared/protocol/upstream/README.md) describe the public target.

## Ownership

| Installation configuration                     | Runtime records                                                 |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Worker version, domains, compute capacity      | Principals, workspaces, memberships, definitions                |
| Database roles and secret references           | Credentials, grants, spend and capacity reservations            |
| Guest image, checkpoint bucket, network policy | Durable conversations, notifications, publications and receipts |

Keep one OpenTofu declaration, state, and deployment writer per installation. Infrastructure applies preserve runtime
records. Configure workspaces and mechs through authenticated owner APIs after installing the application.

## Install

1. Select an immutable release and its independently pinned qualification SHA-256. Keep the complete candidate
   directory, including `qualification.json`, inputs, evidence, guest archive, and installation metadata. Follow the
   [artifact checks](operations.md#artifacts) before deployment.
2. Extract `mechane-cloudflare-vVERSION.zip`. It contains the installation module, compiled Worker, Console assets,
   notices, and database commands. Operators deploy these bytes without rebuilding application source.
3. Supply a TLS-verifying Postgres connection and distinct migration and runtime roles. Create the unprivileged runtime
   role before applying grants. Use the Node version recorded in `release.json` for the extracted database commands:

   ```sh
   node migrate.mjs
   node grant.mjs
   ```

   Both commands read `MECHANE_MIGRATION_DATABASE_URL`. The grant command also reads `MECHANE_RUNTIME_DATABASE_ROLE`.
   [Database settings](../packages/worker/server/src/settings/database.ts) define their current inputs.

4. Configure the extracted [Cloudflare module](../infrastructure/modules/cloudflare/README.md) with account, domain,
   settings, secret references, and `qualification.path` plus `qualification.sha256`. Preserve existing resource names
   during upgrades. The provider verifies qualification before uploading modules, Console assets, and the guest image.
5. Review and apply the infrastructure plan under the installation's writer. Require a subsequent empty plan, then check
   readiness, sign-in, actual Console assets, a session event sent through the SDK, and a cold sandbox command.

The application serves the API and Console through the `ASSETS` binding. Keep the HTTPS origin and GitHub callback
`/auth/github/callback` stable. The module also installs the bounded control-change delivery schedule.

`MECHANE_AUTH_RATE_LIMITS` sets address, device-start, principal, and code-attempt allowances. Authenticated API
requests use the principal allowance. Public authentication operations and failed authentication use the address
allowance.

## Secrets

Bind `MECHANE_DATABASE_URL` to the restricted runtime credential. Keep `MECHANE_MIGRATION_DATABASE_URL` in controlled
operator commands only. Serving code cannot write the migration ledger or retired execution tables.

Supply OAuth, model, credential-keyring, and sandbox-service secrets through deployment secret references. Keep values
out of HCL, provider state, manifests, logs, and browser assets. The module's
[variables](../infrastructure/modules/cloudflare/variables.tf) define settings and secret bindings.

Workspace credentials enter through authenticated write-only APIs. Retain earlier keyring versions while existing
ciphertexts or backups need them. Keep database backups, actor storage, workspace checkpoints, and required keys in the
same recovery plan.

For a pre-cutover installation, list historical identities with `mechane history mechs`. Inspect each identity's
unfinished notifications and uncertain effects with `mechane history held MECH_ID`. Pass the returned cursor to
`--after` until it ends, including when a page contains no rows. These reads leave the actual source records intact.

### Model gateway credentials

Bind `MECHANE_MODEL_UPSTREAM_KEY` to use a fixed model gateway key. To issue a bearer token for each inference request,
configure the direct assertion callback with these settings.

| Setting                                 | Value                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `MECHANE_MODEL_ASSERTION_URL`           | Operator-owned HTTPS callback URL such as `https://identity.example.com/inference` |
| `MECHANE_MODEL_ASSERTION_BEARER`        | Secret binding that authenticates Mechane to the callback                          |
| `MECHANE_MODEL_ASSERTION_METADATA_KEYS` | Optional JSON list of session metadata keys, such as `["tenant"]`                  |

Mechane posts the version 1 inference request to the callback. Its `principal` identifies the session creator. OIDC
sessions carry their issuer and subject, server-key sessions carry `cma` and `server`, and Console sessions carry
`mechane` and their principal ID. Treat forwarded metadata as caller-authored. Each listed key is immutable after
session creation, including when the caller omitted it.

Return HTTP 200 with `{"assertion":"<short-lived gateway bearer>"}`. The model gateway must accept the returned bearer
directly. Mechane requests a fresh assertion for every provider attempt and keeps it in memory for that call. Configure
an assertion supplier that issues a gateway-ready credential when your identity provider needs a token exchange.
[Managed Agents inference provider](https://platform.claude.com/docs/en/managed-agents/self-hosted/inference-provider#short-lived-tokens)

## Memory version retention

Mechane keeps each memory revision for at least 30 days. For a memory that still exists, it keeps its five latest
revisions regardless of age and always preserves the current revision. The scheduled Worker removes older history in
batches. Deleting a memory keeps its recent version history available through the version API. Deleting its entire store
removes the store and its history. Export versions before the retention window ends if you need longer history.
[Managed Agents memory history](https://platform.claude.com/docs/en/managed-agents/memory#audit-memory-changes)

## Inference and built-in web tools

Set `MECHANE_MODEL_UPSTREAM_URL` to the gateway. Each entry in `MECHANE_MODEL_OFFERS` names the actual upstream model ID
and its billing rates. Set `protocol` on an offer to `anthropic-messages` for a gateway that accepts the Anthropic
Messages API. Offers without a protocol use Chat Completions. The name supplied by a client must resolve to one
configured offer. The gateway's reported model must match that offer. Set `cacheWriteOneHourMicrosPerMillionTokens` when
one-hour cache writes have a different price. Mechane reserves at the higher cache-write rate and uses the reported
duration to settle the charge.

For an offer that accepts effort, list its `efforts` and optionally select a `defaultEffort` from that list. Fast mode
requires an Anthropic Messages offer with its own `fastPricing` in the same units as the standard rates. A session with
a cost budget also requires a list price at its selected speed. A fast response must report fast usage for the request
to complete. Gateway sessions reject `inference_geo`.
[Self-hosted model settings](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)

Web tools default to off. To accept web tool declarations, set `CMA_WEB_TOOLS__ENABLED=true` on the application Worker.
Set `CMA_WEB_TOOLS__ALLOWED_DOMAINS` or `CMA_WEB_TOOLS__BLOCKED_DOMAINS` to a comma-separated list of hosts, or set
`CMA_WEB_TOOLS__MAX_CONTENT_TOKENS` to limit fetched text. Any of these limits also enables declarations by default. The
server checks agent and session configurations against those limits. The gateway provider omits both built-in web tools
from model requests for either message format, including for Claude model IDs. Give the agent a custom or authorized MCP
search or fetch tool for web access on this transport.
[Provider support in self-hosted Managed Agents](https://platform.claude.com/docs/en/managed-agents/self-hosted/differences)

## Service credentials

A shared workspace owner can give each integration its own Managed Agents API credential. Choose one stable subject per
service. The first rotation creates its principal. Later rotations keep its principal ID and immediately revoke the
previous key. The command writes the bearer to an owner-only file. Its ordinary and JSON output contain key metadata.

```sh
mechane service-principal rotate nexus-maintenance --workspace "$WORKSPACE_ID" --key-file "$KEY_FILE"
mechane service-principal show nexus-maintenance --workspace "$WORKSPACE_ID" --output json
mechane service-principal revoke nexus-maintenance "$KEY_ID" --workspace "$WORKSPACE_ID"
```

Put the new file's contents in the integration's secret store. Use that credential with the stock Anthropic SDK or `ant`
against this installation. Reuse the principal ID when granting the service access to installed commands. On an
OIDC-only installation, integrations authenticate with their issued OIDC identity.

## Installed command access

A workspace owner can grant an installed agent’s shell access to a workspace credential. Scope the grant to the managed
agent and the principal that opens the session. The installed worker receives the resolved value during command
execution.

```sh
mechane execution-access set "$AGENT_ID" "$GRANTEE_PRINCIPAL_ID" --workspace "$WORKSPACE_ID" \
  --access '{"variables":{},"secrets":{"NEXUS_API_KEY":"nexus-service"}}'
mechane execution-access show "$AGENT_ID" "$GRANTEE_PRINCIPAL_ID" --workspace "$WORKSPACE_ID"
mechane execution-access revoke "$AGENT_ID" "$GRANTEE_PRINCIPAL_ID" --workspace "$WORKSPACE_ID"
```

The value `nexus-service` names a credential already stored in this workspace. The read operation returns configuration
and credential references. External workers manage their environment independently.

## MCP and agent identity

To let agents call an MCP server, set `MECHANE_MCP_ALLOWED_HOSTNAMES` to a JSON array of exact hostnames, such as
`["mcp.example.com"]`. The default is empty. A trusted private destination must also appear in
`MECHANE_MCP_PRIVATE_HOSTNAMES`. Use HTTPS, or explicitly allow HTTP on loopback for local development. Vault bearer
credentials match by server URL after normalizing host casing, default ports and trailing slashes. Paths, non-default
ports and query parameters distinguish credentials. Tool results default to a 100 KiB limit. Set
`MECHANE_MCP_MAX_RESULT_BYTES` to adjust it. The configured limit must fit a truncation notice. The connector retains a
bounded prefix of text and marks a truncated result. If the raw response exceeds 8 MiB before it can decode the JSON-RPC
envelope, the tool result is marked truncated and its outcome unconfirmed. The connector tries streamable HTTP first. An
older SSE server can advertise its message endpoint on the same origin under the configured endpoint’s parent path.
Signed identity also checks that endpoint against its audience URL prefixes. Keep private DNS and outbound routes under
the installation operator’s control. The runtime checks resolved addresses before each request. Configure the outbound
network to enforce the allowed destinations at connection time.

If a server authenticates agents, configure `MECHANE_AGENT_IDENTITY` in Worker settings and bind the RSA private key as
the secret `MECHANE_AGENT_IDENTITY_PRIVATE_KEY_PEM`. For example:

```json
{
  "issuer": "https://identity.example.com",
  "audiences": [{ "audience": "https://mcp.example.com", "urls": ["https://mcp.example.com/tools"] }]
}
```

Route the issuer hostname to the Worker. Receivers fetch public keys at `/.well-known/jwks.json`. Each audience is
limited to its configured URL prefixes. Set the MCP server's `auth` to
`{"type":"agent_token","audience":"https://mcp.example.com"}` for a signed bearer token, or use `agent_token_header`
with the audience to send identity alongside a vault credential. When rotating the signer, retain the previous public
PEM in `publishedPublicKeys` until outstanding tokens expire.

## Git repositories

Set the Worker binding `MECHANE_MANAGED_GIT` to a JSON string when the installation accepts Git repository resources.
The following policy allows reads from GitHub and pushes to branches under `agent/`.

```json
{
  "allowedHostnames": ["github.com"],
  "allowedPushRefs": ["refs/heads/agent/"],
  "commitAuthorName": "Maintenance",
  "commitAuthorEmail": "maintenance@example.com"
}
```

An empty configuration accepts no repositories. A host entry matches its exact hostname and port, defaulting to 443. For
a private Git host, also put its hostname in `privateHostnames` and provide network access to that host. An exact push
ref grants one branch and a trailing slash grants branches with that prefix. The server rejects tag updates and branch
deletion. With no author configured, commits use `Claude <noreply@anthropic.com>`. Set both author fields to override
this identity.

Create a session with a `github_repository` resource containing its HTTPS `url`, an optional `checkout` (branch or
commit), and an optional `mount_path`. The checkout defaults to `/workspace/<repo>` at the repository's default branch.
Supply `authorization_token` for private reads or branch writes. The server stores this value encrypted and adds it to
upstream Git requests. Use the SDK's session resource update to rotate it. Opening pull requests uses a separately
authorized GitHub tool, such as the GitHub MCP server.

## Local

Use the repository's pinned tools, the release-qualified celld build, and Docker for source development:

```sh
mise run setup
mise run dev
```

`dev` and `start` launch retained local state at `~/.local/state/mechane`, or `MECHANE_LOCAL_STATE_DIR`. The supervisor
starts a watched celld application, separate environment host, real Docker guest, TLS Postgres, and deterministic HTTP
fixtures. An application reload preserves the guest. The printed origin opens the Console.

An explicit `MECHANE_LOCAL_CELLD_BINARY` JSON override supplies `executable`, `version`, and `sha256`; startup checks
that identity. The [stack settings](../packages/node/stack/src/settings.ts) own local options. Local qualification does
not establish Cloudflare container parity.

## Use

Use the Mechane CLI to issue a principal key for your installation. Select an unused path in a private directory.

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane key create --name agent-console --key-file ~/.mechane-agent-console.key
```

Approve the request as a workspace member. In a terminal dedicated to this installation, use its origin and private key
with Anthropic's [official CLI](https://github.com/anthropics/anthropic-cli) or SDK:

```sh
export ANTHROPIC_BASE_URL="$MECHANE_ORIGIN"
export ANTHROPIC_API_KEY="$(cat ~/.mechane-agent-console.key)"
ant beta:agents list
ant beta:environments list
```

Select an agent and environment from the output. Start a new session or reconnect to a previous one using the
[session instructions](notifications.md). Workspace owners configure membership, credentials and
[execution access](agent-environments.md). `mechane --help` lists installation operations.

Read the [operations guide](operations.md) before upgrades. Moving preserved histories to actors requires positive
retirement of the previous execution owner and a reviewed, digest-bound import. Import preserves maintenance holds;
activation is a separate decision.

## Managed Agents client authentication

For a new installation, generate a random server API key and bind it to the application Worker as the
`MECHANE_SERVER_API_KEY` secret. Configure the installation workspace with `MECHANE_BOOTSTRAP_WORKSPACE_ID` and
`MECHANE_BOOTSTRAP_WORKSPACE_NAME`. Give the operator the key through your normal secret manager. The official SDK and
`ant` use `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY`. Their first authenticated request provisions the workspace and a
dedicated administrator principal. Rotate the Worker secret to replace the key. Records retain their creator across
rotations. GitHub OAuth is optional for API-only installations. Configure both GitHub client bindings to enable browser
sign-in.

To grant people or services their own access, set `MECHANE_OIDC_ISSUERS` to a JSON array in Worker settings. For
example, this issuer grants developer access to engineers and administrator access to operators.

```json
[
  {
    "name": "staff",
    "issuer_url": "https://login.example.org",
    "audiences": ["api://managed-agents"],
    "roles": [
      { "group": "eng-*", "role": "developer" },
      { "group": "agent-operators", "role": "admin" }
    ]
  }
]
```

Clients send a signed token as `Authorization: Bearer <token>`. Mechane obtains public signing keys through HTTPS
discovery. To pin the key source, set `jwks_uri` to a trusted HTTPS endpoint or supply a public `jwks` document in the
issuer entry. Keep the issuer name, URL, and subject claim stable, since they identify the creator. The highest matching
role wins. Unmatched groups receive 403 unless the issuer defines `default_role`.

Administrators can manage every resource in the installation. Developers and users can manage what they create, read
shared environments, and run sessions there. Only administrators manage environments and their keys. Set
`MECHANE_REFUSE_SERVER_API_KEY=true` with at least one issuer to require OIDC for Managed Agents API requests. With no
server key or issuers configured, the API accepts Mechane member credentials. The browser console uses its workspace
login. Outbound credentials agents present to MCP servers have their own configuration.

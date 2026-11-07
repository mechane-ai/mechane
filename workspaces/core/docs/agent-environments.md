# Agent environments

A mech is a durable identity with memory, native conversation history, and a persistent developer environment. Slack and
the Console admit work to that identity. The runtime serializes a mech's executions because its tools share memory and
files. Different mechs can work independently.

The agent chooses commands and follows the repository's instructions. Mechane provides tools and current authority; it
does not prescribe coding, review, merge, or deployment stages.

## Access

A workspace owner writes a credential from a private file, then grants references and public variables to a mech:

```sh
mechane credential put application-agent --file /private/path/application-key
mechane execution-access show MECH_ID
```

Use `execution-access set` with the current
[grant schema](../packages/shared/protocol/src/operations/execution-access/schemas.ts). It separates GitHub identity,
public environment values, command secrets, and a host-only request service. Metadata reads contain references, never
secret values. Revoking a grant affects subsequent commands without broadening another credential to compensate.

For GitHub, configure the App, installation, repository, and signing-key reference. The runtime mints a
repository-scoped installation token and checks its returned permissions. `gh` receives `GH_TOKEN` and `GH_REPO`; git
receives only the transient credential path for that repository. The App private key stays in the host. GitHub branch
protection still determines whether a merge is permitted.

Configure application CLIs using their ordinary environment settings. Nexus uses `NEXUS_API_KEY` and `NEXUS_URL` in the
sandbox. Its request-service credential is a different host-only reference, with a stable Nexus service ID and
configured request collection. The model cannot choose the service URL, credential, callback destination, or requester.

Credentials are resolved inside trusted steps immediately before use. Workflow state stores references only. Injected
values are redacted from retained output. Arbitrary granted code can deliberately copy its credentials, so choose the
intended authority rather than treating redaction as a sandbox permission boundary.

## Tools and files

The generic image includes the developer tools needed to clone, edit, test, and publish repositories. Repository pins
remain authoritative. Install additional tools inside the sandbox when allowed by its network policy. The
[native tool definitions](../packages/node/runtime/src/tools/runtime-tools.ts) own current names and input shapes.

Memory tools read and update durable documents with version checks. Work tools record useful progress and verified
outcomes separately from conversation sessions. Remote tools come from the current owner-configured MCP connection and
grant. No tool can infer new authority from a remembered instruction.

The sandbox checkpoints its home files after a completed command. Keep reproducible dependency caches and build output
in scratch locations; file checkpoints have explicit archive limits. A failed checkpoint preserves the previous saved
generation and remains visible. Unfinished writes and background processes have no durability guarantee.

Every command uses a stable execution ID. `bash_status` observes its receipt without resubmitting the command. If a
machine disappears before a receipt commits, the result stays uncertain. Check the remote branch, PR, deployment, or
other affected system before deciding whether to repeat an external write.

## Waiting

Nexus decides whether a capability is standing, automatically granted with notification, or subject to approval. The
runtime records the external request identity and registers its durable wait before a decision can arrive. Authenticated
decision events resume that work without another human message or a polling model call.

A ready event means access may be usable. Read the current Nexus request or collect the authorized token before acting.
Denial, cancellation, expiry, and changed service authority have explicit outcomes. A late event cannot reopen canceled
work. Original requester attribution and Slack destination remain fixed throughout the wait.

Use native Workflow waits for durable pauses. The SDK owns suspension and resumption; tracked work records describe
progress rather than recreating the former alarm scheduler. Keep active model and shell requests bounded.

## Qualification

Before publishing a runtime, run the compiled local smoke with real Postgres and deterministic providers. Separately
qualify the selected live image, network policy, repository, and credentials. A missing required tool or environment
capability is a visible limitation, never a passed suite.

The coding flow starts with a real Slack request and ends with a verified deployed revision in that thread. Keep the
checked PR head, merge, release, and deployed revision in the delivery work record. The repository owns its build and
release instructions; Mechane owns generic execution, identity, and durable recovery.

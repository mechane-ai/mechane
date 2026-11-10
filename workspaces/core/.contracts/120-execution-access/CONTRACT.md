---
name: execution-access
message: Give shell commands only their mech’s current owner grant and keep credential material out of durable execution records.
paths: ["packages/shared/protocol/src/operations/execution-access/**", "packages/shared/sandbox-wire/src/**", "packages/worker/edge/src/operations/execution-access/**", "packages/worker/integrations/src/github/tokens/**", "packages/worker/integrations/src/resolve-integration-secret.ts", "packages/worker/integrations/src/requests/**", "packages/worker/harness-tools/src/requests/**", "packages/worker/mech/src/{hands,requests}/**", "packages/worker/rpc/src/{execution-access.schemas,sandbox.schemas,workspace.types}.ts", "packages/worker/workspace/src/workspace-object.ts", "packages/worker/workspace-store/src/execution-access/**", "packages/worker/sandbox/src/executions/**", "packages/worker/sandbox-store/src/executions/**", "packages/node/guest/src/executions/**"]
---

## Rules

Keep one execution-access grant per workspace mech in `workspace-store`. Read and replace it only after checking
current workspace ownership at the edge. Record the acting principal, credential, target, and grant or revoke outcome.
A source-publication grant does not authorize execution access. Forks and drones receive no execution grant implicitly.

Resolve references through the existing encrypted workspace credential store immediately before a command. Mint GitHub
installation tokens for exactly the configured repository and declared permissions. Validate the returned repository
and complete permission set. A denial never selects a broader identity or falls back to an operator credential.

Keep public configuration and credential references in grant records. Carry secret values through the trusted execution
transport as redacted values; never include them in execution rows, RPC outcomes, logs, managed Git files, or checkpoints.
Git and GitHub CLI use the child environment. The Git helper matches HTTPS, GitHub's host, and the exact repository path.
The App signing key remains in the trusted runtime.

Read grants again for later commands. Revoke issued GitHub tokens after a known terminal outcome. An interrupted wait
must not invalidate a command that may still be running; its token expires at the provider. Grant revocation stops new
issuance, not arbitrary external effects already authorized. Repository protection remains GitHub's responsibility.

Redact exact injected values before retaining output. Truncated output must not expose a credential suffix. The guest
can read its credentials and deliberately copy them; redaction is accidental-disclosure protection, not a restriction
on the authority granted to arbitrary code.

Keep a request-service credential separate from command credentials. Only the owner-configured collection may receive
it; models supply a request kind or capability and stable ID, never a URL, credential, or trusted actor. Resolve the
current grant and credential before every submission and status read. Bound transport time and bytes, refuse redirects,
validate returned request kind and ID, and keep raw provider failures and credential material out of tool results.

Build requester context from the work thread's persisted verified inbox origin. Ambiguous input has no inferred actor.
A command key, model-supplied identity, message, or header must not become trusted requester context. The external
service owns capability policy, approver selection, and grant revocation; Mechane only submits and observes requests.
Persist automatic-access notices through the existing original-thread outbox, independently of the model's reply.

## Checks

Run the execution-access smoke through the CLI and packaged runtime. Check grant persistence, immediate revocation,
output redaction, and absence from scanned runtime files. Exercise foreign ownership and a fresh fork without a grant.
Review every credential transport and persistence boundary when it changes. Verify the Git helper refuses another
repository and host. Live qualification checks actual App permissions and ordinary Git/`gh` behavior; it stays outside CI.
Exercise the request service with a host-only credential through its actual local HTTP boundary. Verify a guest cannot
read that credential, changed service configuration refuses an older request, and closed work cannot gain a new wait.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

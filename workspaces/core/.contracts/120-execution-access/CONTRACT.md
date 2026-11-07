---
name: execution-access
message: Give commands only their current owner grant and keep credential material out of durable execution records.
paths: ["packages/node/runtime/src/{compute,tools,requests,store,models}/**", "packages/node/server/src/sandboxes/**", "packages/shared/protocol/src/operations/execution-access/**", "packages/shared/sandbox-wire/src/**", "packages/worker/sandbox*/src/**", "packages/node/guest/src/executions/**"]
---

## Rules

Keep one current execution grant per workspace mech in the runtime store. Owner-only operations record the acting
principal and grant or revoke result. A session, model message, or fork does not grant new authority.

Resolve credential references immediately before the trusted operation. Mint GitHub installation tokens for the
configured repository and permissions, then validate the returned authority. A refusal never selects a broader
identity or an operator's credential. Read the current grant again for subsequent commands.

Store public configuration and references in grants. Inject shell credentials only into the command environment.
Keep the App signing key and Nexus request-service key host-only. Credentials never enter Workflow arguments,
results, model serialization, tool-call traces, command receipts, managed Git configuration, or file checkpoints.

For foreground commands, revoke a minted GitHub token after a known terminal result, independently of receipt persistence succeeding. Revoke
it after a pre-dispatch failure when the command was definitely not submitted. An interrupted observation cannot
revoke a token from a command that may still be running; its provider expiry remains the bound. Revocation prevents
future issuance and does not undo an external effect already authorized. Repository protection remains GitHub's
responsibility.

Managed background processes receive startup credentials under the same current grant. Revoke a minted token when
the initial start is definitely unsubmitted or already terminal. After an admitted running or uncertain start, its
provider expiry bounds access; later process reads, stops, or machine loss do not promise immediate token revocation.
Do not persist the token in execution state, renew it from passive observation, or add an in-memory cleanup claim that
cannot survive a host restart. A new process requires a new grant check and cannot reuse another process's authority.

Redact injected values before retaining output, including truncated output. A guest can deliberately copy credentials
it is authorized to receive; output redaction limits accidental disclosure rather than restricting arbitrary code.

Authenticate Node-to-sandbox calls separately from command credentials. Bind stable sandbox and execution IDs to the
admitted workspace and mech. Reusing an execution ID with another input is refused. Read the original receipt after
an uncertain response instead of dispatching another side effect.

Apply the workspace's current `machines` limit before physical machine acquisition. The sandbox's capacity owner
coordinates both command and maintenance starts. The Node store checks policy and reserves capacity under one
workspace lock, so concurrent mechs cannot exceed the limit. Reusing an allocated machine does not consume another
slot. A zero limit refuses new commands as well as new allocations, including commands for an already warm machine.

Keep an allocation while its machine stop or required checkpoint is unresolved. A completed run, timeout, failed
start, or absent response does not release capacity. Release only after confirmed physical stop, matching the mech's
reservation and machine identities. Retain the released reservation's sequence so delayed callbacks cannot revive
it or release a replacement. Authenticate these callbacks with the existing service credential, never a guest key.

Models supply a Nexus request kind and requested capability, not a callback URL, credential, or trusted person.
Build requester attribution from the persisted, verified originating input. Nexus owns policy, approvers, grants,
revocation, and notification delivery. Mechane rechecks the effective permission before continuing.

## Checks

Exercise the packaged API and command path with a current grant, revoked grant, foreign workspace, reused execution
ID, and lost response. Check emitted output and stored records for fixture credential values.

Include a foreground command that outlives the initial response wait. Its eventual terminal receipt must still revoke the
minted token; returning a running receipt must not abandon cleanup or revoke a still-running command's access.
Inject a pre-dispatch failure and a terminal receipt-write failure; both must still attempt the required revocation.
For managed processes, separately verify initial terminal and definitely unsubmitted cleanup, the provider-expiry
policy after an admitted start, and absence of fresh credentials on read, list, and stop.

Extend the representative compute flow with a zero limit, concurrent mechs at a one-machine limit, reuse, and a host
restart. Refused acquisition must not start a machine. Failed checkpoint or stop must retain its slot; confirmed
release must make it available once. Exercise duplicate and delayed callbacks against a replacement reservation.

Verify GitHub token scope and ordinary git/gh commands during authorized hosted qualification. Check that the guest
cannot read the host-only Nexus key, and that changed request-service configuration refuses an older correlation.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

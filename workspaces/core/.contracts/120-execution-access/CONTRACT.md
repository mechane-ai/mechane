---
name: execution-access
message: Give tools only current environment authority and keep credentials out of durable execution records.
paths: ["packages/worker/runtime/**", "packages/worker/control-store/**", "packages/worker/server/src/sandboxes/**", "packages/shared/protocol/src/operations/connections/**", "packages/shared/protocol/src/operations/credentials/**", "packages/shared/protocol/src/operations/execution-access/**", "packages/shared/protocol/src/operations/sandboxes/**", "packages/shared/sandbox-wire/src/**", "packages/worker/sandbox*/src/**", "packages/node/guest/src/executions/**"]
---

## Rules

Keep one current execution grant per workspace mech. Owner-only operations record the acting principal and grant or
revoke result. A notification, model message, remembered instruction, or fork grants no authority.

Keep grants generic: public environment variables and encrypted credential references. Resolve references immediately
before dispatch and inject values only into the authorized command environment. Recheck the grant for each new effect.
Provider-specific issuance, scope validation, expiry, and revocation belong to the configured application or credential
service. A refused credential never selects a broader identity or an operator's credential.

For MCP, the current connection and grant read after discovery admits that one call. Later grant revocation governs
subsequent calls. Native execution and current workspace-policy checks remain additional dispatch vetoes; admission
does not bypass them.

Keep credential values out of durable task arguments, checkpoints, model serialization, tool traces, command receipts,
managed Git configuration, and file checkpoints. Resolve live clients inside trusted steps. Read, list, and stop
operations observe their original execution without issuing fresh startup credentials. Revocation affects subsequent
dispatch; it cannot undo an external effect already authorized or recall a credential from a running process.

Redact injected values before bounding and retaining output. A guest can deliberately copy credentials it is authorized
to receive; redaction limits accidental disclosure rather than restricting arbitrary granted code.

Capture inspectable bash input once after resolving that command's actual secrets and before dispatch. Redact values
before bounding the snapshot and omit environment values. Only a freshly created execution receipt can gain a snapshot.
A resumed receipt with no snapshot keeps its input unavailable, including a crash between receipt creation and capture.
Project only safe input and allowlisted result fields through authorized traces. Bound previews and the serialized
collection, with explicit omission notices. Never reconstruct historical redaction from raw messages or current secrets.
Keep inspection data out of the immutable execution request and its replay comparison.

Authenticate application-to-sandbox calls separately from command credentials. Bind stable sandbox and execution identities to
the admitted workspace and mech. Refuse changed input under an existing execution ID. Observe the original receipt after
an uncertain response instead of dispatching another effect. Check the active owner's fence and notification watermark
before a fresh effect, as required by contract 124; a refused dispatch must not allocate compute or mint credentials.

Apply the workspace's current `machines` limit before physical acquisition. The capacity owner coordinates command and
maintenance starts. Check policy and reserve under one workspace lock so concurrent mechs cannot exceed it. Reusing an
allocated machine consumes no additional slot. A zero limit refuses commands even on an already warm machine.

Keep allocation while machine stop or required checkpoint is unresolved. Completion, timeout, failed start, and missing
responses do not release capacity. Release only after confirmed physical stop matches the mech's reservation and machine.
Retain the released reservation's sequence so delayed callbacks cannot revive it or release its replacement. Authenticate
callbacks with the service credential, never a guest key.

## Checks

Exercise the packaged API and command path with current and revoked grants, a foreign workspace, a reused execution ID,
and a lost response. Inspect emitted output and persisted records for fixture secrets. A new-notification refusal must
leave no execution, credential-issuance, or machine-acquisition effect.

Inspect a nonzero result, missing historical input, and bounded output through the same trace. Verify native tool
completion preserves the exit code, replay preserves its original snapshot, and missing input cannot fall back to raw
model messages. Observe a running process without fresh credential resolution or a replacement command.

Extend the representative compute flow with a zero limit, concurrent mechs at a one-machine limit, reuse, and a host
restart. Failed checkpoint or stop retains its slot; confirmed release makes it available once. Exercise duplicate and
delayed callbacks against a replacement reservation. Qualify application CLI authority at its owning service boundary.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

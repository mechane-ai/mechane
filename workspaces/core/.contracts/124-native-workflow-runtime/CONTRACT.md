---
name: native-workflow-runtime
message: Keep one native Workflow execution path with replay-safe side effects, private credentials, and standard AI SDK streams.
paths: ["packages/node/runtime/**", "packages/node/server/**"]
---

## Rules

Use AI SDK's native model, tool, message, and stream types. WorkflowAgent and Workflow SDK own execution checkpoints,
step retries, hooks, and resumable streams. No Pi executor, custom workflow engine, patched dependency, or private SDK
import remains in the production path.

Mechane's domain store owns identity, definition revisions, session admission, work, memory, authorization, and usage.
Each accepted input gets a stable run identity and trusted source. Claim the earliest queued run atomically per
mech. Native hooks wake queued runs; different mechs may execute independently. A duplicate input cannot create
another run, and terminal completion cannot leave the next accepted input stranded.

Keep workflow arguments and checkpoints serializable and secret-free. Persist references, then resolve credentials,
live grants, clients, and provider configuration inside trusted steps. The model adapter's serialization hook stores
identifiers only. Do not serialize a provider instance whose headers contain a credential.

Give every consequential tool effect a stable receipt identity. Step replay returns the recorded outcome; an uncertain
outcome requires reconciliation before retry. Bound each external transport and preserve cancellation and terminal
failure as durable product states. Failure to deliver a reply does not repeat the agent's completed work.
Use the store's committed result for cancellation and replies. An earlier snapshot cannot replace a completed or
failed outcome with a cancellation notice.
Commit the terminal run state and any canonical reply before closing its durable output stream.

Report readiness only after a bounded native Workflow health check confirms queue execution. A listening HTTP server
or database connection alone is insufficient. Failed startup closes its listener and World instead of serving success.


## Checks

Run the compiled server and Workflow Postgres World with the repository-pinned SDKs. Interrupt and restart a workflow
during a tool wait, then verify one side effect, one terminal run, and continued queued input. A step retry must not
lose metering or source attribution.

Prevent the native worker from starting and confirm the host never reports ready. Exercise normal startup and shutdown
through the same packaged server path.

Consume full and resumed streams with the native AI SDK reader. Check cursor behavior after a failed model step,
unauthorized resumption, and client disconnect. Inspect serialized Workflow state for fixture credentials. Dependency
boundaries and type checking verify public SDK entry points; behavioral qualification establishes replay correctness.
At terminal stream completion, an immediate domain read must return the committed outcome and reply without waiting
for a polling interval.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `workflow-server-owner` (124): enforced: Keep Workflow execution dependencies in the Node runtime, such as `workflow` in a durable step

<!-- End of the generated block. -->

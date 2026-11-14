---
name: eval-run-lifecycle
message: Freeze inputs before paid work, checkpoint results atomically, and resume only the same experiment.
paths: ["packages/node/eval/src/**", "packages/node/cli/src/failures/eval-failure-messages.ts"]
---

## Rules

Start evaluations that spend money or need credentials only on explicit request, outside the ordinary checks.
Freeze case selection, case inputs, expected outcomes, rubrics, grader settings, run configuration, and the runner and assessed-system build identities before the first paid request.
Before paid work starts, confirm that every selected case's setup material exists and fits its declared limits, and report missing material as a setup failure rather than a case result.
Persist the original deadlines and budgets with the run, so that recovery neither renews nor exceeds them.

Resume only from the saved snapshot and checkpoints, never from exported reports or terminal output, and reject a resume whose inputs, configuration, runner, or assessed-system build differ.
Allow one writer per run, and reattach to an existing run instead of starting another.
Submit each case under an operation identity recorded as `code-execution-lifecycle` requires, save its receipt before waiting for its result, and resume from that receipt instead of submitting again.
Reject a result that names a different run, submission, or assessed-system instance than the saved receipt.
On resume, keep saved outputs and grades instead of requesting or grading them again, and keep earlier errors when an explicit resume retries unfinished cases.

Save each assessed output atomically before queuing its grade, and save each grade atomically.
Keep the completed stages of a multi-stage case when a later stage fails.
Wait for pending usage or cost accounting to settle as complete or unavailable before recording a case as finished.
Record trace events from every attempt under increasing sequence keys, and skip events already recorded when replaying.

Bound assessment concurrency, grading concurrency, and the waiting queue separately.
Run each case that needs a workspace in a fresh, disposable one.
Cancel a run through the assessed system's public interface, and leave queued cases unstarted.
Distinguish cancelling a run from detaching a client, and keep both behaviors the same after reattaching.
Retry failed cleanup separately from case results, and never let cleanup rerun or change a completed case.

## Checks

Interrupt a run after an output is saved and before it is graded, resume it, and confirm that the output is unchanged and no new request was made for it.
Resume a completed run and confirm that it makes no new paid requests.
Change one frozen input or build identity and confirm that resume is rejected.
Cancel a run and confirm that queued cases stay unstarted and case workspaces are removed.
Compare a resumed run's deadlines, budgets, and trace sequence with the originals.

## Local adaptations

`@mechane/eval` owns the Node run coordinator, reached through its public library or `mechane eval run`.
Both application-tool suites and the reply-suite adapter use the same notification-driven role lifecycle.
`manifest.json` freezes the suite, adapter fingerprint, tools, grade schema, bounds, target identity, and selected trials.
Validate the suite and deployment readiness before agent creation. Verify each created role's selected tool profile
before notification admission or model work. Record transport credentials separately from the manifest.

Each role intent records its creation request identity, notification identity, selected native tools, cap, and original
deadline before either public operation is sent. A saved receipt identifies the same mech and notification across
recovery. Native activations and trace dispatches belong to that receipt; final private model text is diagnostic only.
MCP observations are saved before acknowledgment, and evidence is saved before its judge starts. Per-stage files are
created once. The SQLite exclusive writer lock is released by the operating system after a crash.

Run trials and roles sequentially. Resume verifies the frozen experiment and preserves completed stages. A completed
resume does not call a model. A failed or cancelled role is evidence, not authority to rerun it silently. Ctrl-C
requests cancellation and retains recorded results. Cleanup waits for terminal activation state within its deadline,
archives owned mechs, and deletes their scoped connections and credentials. An unconfirmed cleanup remains visible
and can be retried without executing or grading again.

A transport restart can recreate endpoint addresses and credentials, while preserving recorded calls and request
receipts. It cannot guarantee that an agent interrupted by the outage is still running. Pi/provider retry behavior
can issue another paid attempt; stable operation identities are not an exactly-once billing guarantee.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

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

`mechane eval run` reaches the deployed `/api/v1` system only on explicit invocation. The smoke uses the scripted upstream.
The frozen `plan.json` holds suite inputs, expectations, models, repeats, caps, workspace, release revision, and digest.
Grader instructions belong to that release. Invalid suites fail before sending, and a changed frozen plan is `PlanChanged`.
Plan version 2 and report version 3 describe notification-driven evaluation. Older out folders are refused without being
rewritten or deleted; the version change does not authorize another paid evaluation automatically.

Persist each role's creation request and random `notificationId` before creating its mech. Retry uncertain creation
with the same request identity, then save the resulting mech before admission. Retry uncertain admission under that identity,
never with a replacement notification. Observe all bounded activations on that fresh mech, save their `runIds`, and collect
all corresponding trace dispatches. A role is complete only after its activation chain settles. Save its explicit public
Console message identity and text, or the recorded quiet, failed, or stopped outcome. Native final model text is not output.

Each output file is created once, atomically. Save the subject before creating its grader intent. Resuming never requests
or grades a saved role again. The local out-folder lock rejects a running owner and removes itself on ordinary exit.
Trials and roles run sequentially, with no waiting queue. Each role uses a fresh mech with no inherited context or grant.

The existing lifecycle has explicit gaps: takeover of a dead-process lock is not atomic between competing clients,
and no public archive operation removes completed role mechs. Ctrl-C still detaches rather than
canceling the remote activation. These limitations do not satisfy the stronger cancellation and cleanup Rules above.

The plan freezes each role's cap and checks available allowance before creation. No role-wide deadline is persisted;
individual dispatches have bounded deadlines. Reserved dispatches still contribute zero recorded charge in this runner,
so an interrupted unsettled attempt is an accounting gap rather than proof of no spend. Preserve these gaps in eval review.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

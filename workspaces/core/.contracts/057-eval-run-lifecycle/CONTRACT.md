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

The assessed system is the deployment behind `/v1`, and `mechane eval run` is the runner: it starts only when a person runs it, and the smoke runs it only against the scripted upstream.
The frozen inputs are `plan.json`: the suite, with its cases, expectations, models, repeats and `trial_cap_micros`, the deployment's release and worker revision, the workspace, and their digest, saved once its refusals passed and before the first send; the grader's instructions are the release's own, which the release covers.
A rerun with the same `--out-folder` resumes, follows the plan it builds and never an edited `plan.json`, and refuses another digest as `PlanChanged`; a suite that does not decode is `SuiteInvalid` before any call.
The budget is each mech's cap, `trial_cap_micros`, which the plan freezes, and a plan whose turns yet to send could spend more than the day's allowance has left is `AllowanceExhausted` before any mech exists; no run deadline is persisted, since a role waits for its turn's end with no deadline of its own and each dispatch has its own, as `code-execution-lifecycle` records.
`lock.json` names the process whose run writes the out folder, so one run at a time writes it: a lock whose process runs refuses another run as `OutFolderBusy`, the run's scope removes its lock, Ctrl-C included, and a lock whose process no longer runs, as after a crash or a second Ctrl-C, is taken over; two runs that take over one lock at once could both hold it, and each record's file is still created once.
A role's intent, its fresh mech and the inbox item's random id, is the receipt, saved before its send; a rerun sends a role whose intent it holds without its record again under the intent's id, which the deployment receives once, so it resumes the same turn instead of submitting another, and a trial is `unavailable` only while a run that sent a turn ended before saving it.
Each record is created once by a link that fails when the file exists, a subject's record is saved before its grader's intent, and a failed grader turn keeps the subject's record; a rerun never asks for or grades a saved role again.
A role's turn is read from its own mech's events and trace, which hold only that one inbox item's turn, and its record names the mech, the item and the turn.
The trace is read once the turn's end is in the log; a dispatch still `reserved` then, whose settlement a lost instance cut off, counts as charged nothing yet.
Trials run one after another, so one assessment, one grading and no queue run at a time; the runner records no trace events of its own, since each mech's log is the deployment's.
Each role runs on a fresh mech with its own sandbox, and no operation archives a mech, so each trial leaves two mechs in `mech list`.
Open: a role's mech is created before its intent is saved, so a run cut off between the two leaves one mech that spends nothing, until `createMech` takes a caller-made id.
Open: Ctrl-C detaches the client and does not cancel the mech's running turn through `cancelTurn`, so the turn runs to its end and spends its cap; cancel and detach are not yet distinct.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

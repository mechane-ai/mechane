# @mechane/eval

The eval runner sends each trial's subject and grader a notification through `/api/v1` and grades their explicit Console
publications. Internal model text is never treated as a reply.

Layer 3 · node lane · effect dialect · consumers: cli-kernel, cli

## Layout

- `src/`: `runEval`, the suite's read, the plan and its check against the allowance, and each case's trials.
- `src/trial/`: one trial: its subject's and grader's turns under saved intents, and the grade.
- `src/store/`: the out folder: its lock, the plan, each trial's records written once, and the report.
- `src/report/`: the report's verdicts, charges and lines.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[057](../../../.contracts/057-eval-run-lifecycle/CONTRACT.md) to
[060](../../../.contracts/060-eval-score-accounting/CONTRACT.md) for the run, its grading and its scores.

## Use

The CLI's `eval run` calls `runEval` with its calls, its workspace and the out folder. A rerun with the same out folder
resumes: every record a run saved stays. Each role's creation request and notification identity are saved before the
mech is created, so an uncertain creation is retried with the same identity. The runner waits for that fresh mech's
activations to stop, records their charges, and uses its latest published Console message. A quiet completion is
`no_reply`, a stopped activation is `stopped`, and a failed activation is `run_failed`; none becomes a grade. Plan and
report versions reject incompatible saved formats without changing those files.

## Never

- Never show a subject an expectation, and never count a reply that is not a grade as a score.
- Never call the deployment but through the client's catalog operations.

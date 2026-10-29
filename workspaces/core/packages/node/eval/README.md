# @mechane/eval

The eval runner: a suite's plan, each trial's subject and grader turns through `/v1`, the out folder's records, and the
report.

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
resumes: every record a run saved stays.

## Never

- Never show a subject an expectation, and never count a reply that is not a grade as a score.
- Never call the deployment but through the client's catalog operations.

# @mechane/eval

Run application evaluations against the Managed Agents API. Each trial gives the subject and judge separate agents,
environments, and sessions. The reply suite grades the subject’s visible session message. Tool suites choose the
recorded observations their judges may see.

Layer 4 · node lane · consumers: cli-kernel, cli, smoke

## Run a suite

For a reply suite, use the Mechane CLI. Supply the installation origin and credentials as for other CLI commands.

```sh
mechane eval run --suite suite.json --out-folder ./eval-run --workspace "$WORKSPACE_ID"
```

Set both the subject and grader models in the suite. Repeating the command with the same inputs and folder resumes the
saved run. Use the public [library API](src/index.ts) for application-specific tools and evidence.

An [EvalSuite](src/application-types.ts) declares the visible inputs, private rubric, tools, role limits, and grade
schema. The runner handles a custom tool call in the eval process and saves the observation before returning its result
through the session API. The judge receives the frozen evidence and the `submit_grade` tool. A valid submission gets a
durable receipt. Exact retries return that receipt.

## Recovery and evidence

The manifest freezes the experiment, target, workspace, and fingerprints. Role receipts identify their agents,
environments, and sessions. On restart the runner reconciles these records before starting work. Each session has its
original deadline and budget. Cleanup can be retried independently of execution or grading.

Inspect per-stage files for the observations, immutable evidence, and accepted grade. The report is a projection. Usage
and reported list cost belong to the session that produced them. Missing accounting evidence stays unknown. Historical
reports can be inspected. They do not provide the execution state needed to resume a current run.

`fingerprintEvalSources` hashes the selected adapter sources. `evalRunnerFingerprint` identifies the installed runner.
Calibration reads the saved labels and evidence digests. `compareExpected` can return `Option.none()` when an
observation and its grade cannot be compared.

The [lifecycle](../../../.contracts/057-eval-run-lifecycle/CONTRACT.md),
[grading](../../../.contracts/058-eval-grading-isolation/CONTRACT.md),
[production path](../../../.contracts/059-eval-production-path/CONTRACT.md),
[accounting](../../../.contracts/060-eval-score-accounting/CONTRACT.md), and
[adapter](../../../.contracts/132-eval-adapter-boundaries/CONTRACT.md) contracts govern the runner.

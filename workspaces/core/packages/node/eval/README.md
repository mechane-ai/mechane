# @mechane/eval

The Node eval library runs application suites through Mechane's public client. Each trial gets a fresh subject and a
separate judge. Suites choose the visible input, fixture tools, frozen evidence, rubric and grade schema. The existing
reply suite assesses explicit Console publications; tool suites can complete quietly.

Layer 4 · node lane · effect dialect · consumers: cli-kernel, cli, smoke

## Layout

- `src/run-eval.ts`: run, resume and cleanup, including the reply-suite consumer.
- `src/application-types.ts`: suite callbacks, targets and stage records.
- `src/environment/`: authenticated MCP hosting and explicit local or cloudflared transport.
- `src/trial/`: native notification admission and activation evidence.
- `src/judge/`: structured submission, regrading and calibration.
- `src/store/`: immutable records and the operating-system writer lock.
- `src/report/`: read-only inspection, comparison and historical adapters.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[057](../../../.contracts/057-eval-run-lifecycle/CONTRACT.md) to
[060](../../../.contracts/060-eval-score-accounting/CONTRACT.md) for the run, its grading and its scores.

## Use

Compose an [`EvalSuite`](src/application-types.ts) with encoded JSON configuration. The resolver turns its millisecond
bounds and serialized values into native durations, measured brands, timestamps and explicit optional values for
execution. [`defineGradeSchema`](src/define-grade-schema.ts) and [`createEvalTarget`](src/create-eval-target.ts) are
Effect factories; yield them before calling `runEval`. `resumeEval` requires matching frozen settings and preserves
operation identities, deadlines, evidence and grades. `cleanupEval` retries cancellation and archival without grading.
The CLI's `eval run --suite-file FILE --out-folder RUN` uses the same core through the reply-suite adapter; repeating
that command resumes its saved run.

Set `definition.connectionName` when subject instructions require a named application connection. Tool descriptions show
that name; each role keeps a separate credential reference for recovery and cleanup.

The manifest and per-stage files are authoritative. Observations and structured grades are saved before their MCP
receipts return. `report.json` is a replaceable projection. Subjects cannot read private rubrics or judge credentials.
Judges receive the suite's evidence allowlist and only `submit_grade`; final model prose is diagnostic. Native traces
retain the model's tool-call ID alongside `invocation_id`, the stable identity that joins adapter calls to their durable
observation receipts.

Cleanup completion, execution failure and quality are separate. Unknown charges stay unknown. Unconfirmed local release
failures remain incomplete until their resource ownership can be resolved; a cleanup retry never clears them merely
because time passed. Historical reports remain inspectable and cannot be resumed.

Comparison requires matching MCP connection names and judge models, instructions, capabilities and grade schemas. A
declared self-grading relationship can change when the subject model changes under a fixed judge; comparison reports
that relationship with the subject experiment differences. The judge receives neither the subject identity nor that
relationship.

## Never

- Never show a subject an expectation, and never count a reply that is not a grade as a score.
- Never call the deployment but through the client's catalog operations.

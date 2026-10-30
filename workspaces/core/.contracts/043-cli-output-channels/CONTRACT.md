---
name: cli-output-channels
message: Write a command-line program's result to standard output and every other line to standard error through one output module, and end the process only from its entry point with a declared exit status.
paths: ["**/*.ts"]
---

## Rules

Apply these rules to command-line programs, scripts, eval runners, and test harnesses.
Lines that `telemetry-application-tracing` covers, such as a server's log lines, follow that contract instead of these rules.
Declare one output module for each program, and write to standard output and standard error only through it.
Never call a console method or a print macro, or open a handle to either standard stream, outside the output module.
A function that receives a writer from the output module may write to that writer.
Write the program's result, such as a report, the matches it found, or a machine-readable document, to standard output.
Write every other line, such as progress, warnings, errors, prompts, and the closing summary, to standard error, so that a reader of standard output receives only the result.
When the program writes a machine-readable document, write each error of the run as a record of that document, in the same envelope as its results.
Declare each machine-readable document's schema version once, as a named constant of the module that declares the document's schema, and have the output module write it from that constant.

End the process only from the program's entry point, by returning its exit status or by passing it to the output module's one exit function, such as `finish({ status })`.
Declare the program's exit statuses once, as a closed set whose member names say what each status means.
When the program has a command model, declare its exit statuses there, so that the generated command reference lists them.
A process exit status, including 0 and 130, is a value the program defines, not one a protocol defines, so `code-closed-value-sets` governs it like any other closed set.
Library code returns an outcome from a closed set, such as a review's overall status, and only the entry point maps each outcome to its exit status.

Enforce these rules with the repository's lint, which reports every console call, print macro, and stream handle outside the output module, every process exit outside the output module and the entry point, and every exit status written as a number outside the one declaration of the program's exit statuses.
Suppress a finding only as `code-lint-suppressions` allows.

Violation: a deploy step calls `console.log('deploy: waiting for readiness')` and then `process.exit(1)` in the middle of the script.
Allowed: the deploy step calls the output module's `reportProgress({ line: 'waiting for readiness' })`, and the entry point passes `ExitStatus.Refused` to `finish`.

## Checks

Run the repository's lint from the repository root and confirm that it reports console calls, print macros, stream handles, process exits, and numeric exit statuses outside their declared paths.
For each line a change writes, is it the program's result on standard output or a diagnostic on standard error?
Does library code in the change compute a process exit status, such as a function that returns 2 or 130, instead of returning an outcome?
For each machine-readable document a change writes, does its schema version come from the one constant of the module that declares the document's schema?

## Local adaptations

Output modules: `packages/node/program/src/output/`, through which every other module of the programs writes, `packages/node/cli/scripts/reference/main.ts` and `packages/node/testing/src/check.ts`; the Worker's one logger is `packages/worker/logs/src/write-log.ts`, whose `writeLog` writes each `LogLine` of `@mechane/protocol` as one JSON line.
Every CLI run writes its results through the writer the output module hands it. A command declares its shape: a document command writes its one result when its run ends, and `event list`, a stream command, writes one record per event as it arrives, as human lines or JSON Lines, its default off a terminal, and refuses `--output json`.
Exit statuses: the CLI's `ExitStatus` in its command model, which the generated block states from the command reference, `DevStatus`, `ReleaseStatus`, `SmokeStatus`, `CheckStatus` and the guest's `GuestStatus` (`Stopped` 0, `Failed` 1). The distribution entry point reports success as 0 and failure as 1 through `reportExit`.
`--output json` writes one envelope whose `schema_version` is `ENVELOPE_SCHEMA_VERSION`, with the result and each error of the run; `--output jsonl` writes the same records one per line.
A usage error is a record too: the CLI decodes the output mode first and writes the error with a null `command`, in the default mode when the mode itself does not decode.
oxlint `no-console`, `unicorn/no-process-exit`, and `no-restricted-properties` on `process.stdout`, `stderr`, `exitCode` and `exit`, with overrides for the output modules, and ast-grep `numeric-exit-status`, which rejects a number as a `status` field or as the return of a function that returns a status, enforce these rules.
oxlint `no-restricted-imports` rejects Effect's `Console`, and `no-restricted-properties` rejects `Effect.log`, each `Effect.log*` level, `logWithLevel`, `withSpan`, `withSpanScoped`, `annotateLogs` and `annotateLogsScoped`, so every diagnostic passes an output module or `writeLog`.
A run answers how it ended, which `invoke` alone maps to a status: `eval run` writes its report as its one result and each trial's progress to standard error, and ends `Failed` when a trial failed to run or grade; Ctrl-C fails it with `EvalInterrupted`, `Interrupted`, so its envelope carries that error.
A run returns its result and never encodes it, since the output module encodes each result once for `json` and `jsonl`; ast-grep `encode-in-runs` ratchets an encode in `packages/node/cli/src/runs` and in the eval runner, `packages/node/eval/src`.

Server log lines still pass through the owned logs package; v11's reference to unadopted telemetry-application-tracing does not remove that existing obligation.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

The CLI's exit statuses, as its command reference publishes them: `Ok` 0, `Failed` 1, `InvalidRequest` 2, `Unauthenticated` 3, `ForbiddenOrNotFound` 4, `Conflict` 5, `Unavailable` 6, `Interrupted` 130.
- oxlint `no-console` (CP-05): enforced, `"error"`
- oxlint `unicorn/no-process-exit` (CP-05): enforced, `"error"`
- oxlint's restricted members (CP-05): enforced: `process.stdout`, `process.stderr`, `process.exitCode`
- oxlint's restricted members (CP-05): enforced: `process.exit`
- oxlint's restricted members (EF-19): enforced in phase A: `Effect.log`, `Effect.logDebug`, `Effect.logError`, `Effect.logFatal`, `Effect.logInfo`, `Effect.logTrace`, `Effect.logWarning`, `Effect.logWithLevel`, `Effect.withSpan`, `Effect.withSpanScoped`, `Effect.annotateLogs`, `Effect.annotateLogsScoped`, `Console` of `effect`
- ast-grep `numeric-exit-status` (CP-05): enforced

<!-- End of the generated block. -->

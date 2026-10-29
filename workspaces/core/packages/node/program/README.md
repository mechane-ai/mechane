# @mechane/program

What every executable shares: its output channels and exit, child processes, signals and files, the locks and the CLI's
records that a program driving it reads. It imports no parser, so the guest bundles it into one file.

Layer 2 · node lane · effect dialect · any node consumer

## Layout

- `src/`: child processes and how one exited, the stop signals, a failure's diagnostic, a failed step's subjects and
  line, and the Worker's revision.
- `src/output/`: the output module: a result line, a diagnostic line and the exit status.
- `src/files/`: a file created once, replaced through a fresh file, or read when it exists, and a JSON file's text.
- `src/cli/`: the CLI's variables, result records and approval notice, as a program driving it reads them.
- `src/locks/` and `src/sources/`: the wire and migration locks' entries, and the words a source names.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[043](../../../.contracts/043-cli-output-channels/CONTRACT.md) for the output channels.

## Use

A program writes through `writeResult` and `writeDiagnostic`; it runs each child with `startProcess` or
`finishedProcess`, inside one `interruptOnSignal`, and wraps each promise it awaits in one `Effect.tryPromise` that
fails as its own failure. A program's failure names its step, the `StepSubjects` the step acted on, and the dependency's
reason, which `stepLine` words. Its `main` maps the run's exit to a status with `reportExit` and its message table,
`FailureLines`, and ends with `finish`.

## Never

- Never write to the console or set the exit status outside `output/`.
- Never import a program's member; every program imports this one.

# @mechane/cli-kernel

What every part of the `mechane` command shares: its constants, failures, output schemas and types, and a run's input
and result.

Layer 4 · node lane · effect dialect · consumers: cli-login, cli-update, cli

## Layout

- `src/`: role files only. `errors.ts` holds every failure the command reports beside its calls and its eval runs;
  `schemas.ts` holds each command's output schema in `COMMAND_OUTPUTS` and the error record; `types.ts` holds a run's
  input, its result and its failures.

## Rules

The [product contracts](../../../.contracts/index.md) apply. A role file imports only earlier roles (ST-34).

## Use

Each run's member types its input with `RunInput<'command name'>` and its answer with `CommandResult<'command name'>`. A
new command adds its output schema to `COMMAND_OUTPUTS`, which fails to compile without one.

## Never

- Never put behavior here; a function belongs to the member whose run calls it.
- Never import another member of the command.

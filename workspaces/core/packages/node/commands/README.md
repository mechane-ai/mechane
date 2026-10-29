# @mechane/commands

The command model: each command's declaration with its flags, arguments, input and the operations it calls, the global
flags, the help and the command reference.

Layer 3 · node lane · data dialect · consumers: cli-kernel, cli-login, cli-update, cli, deploy

## Layout

- `src/`: `COMMANDS`, the global flags and variables, the help's lines and the command reference.
- `src/declarations/`: one file per group of commands, each declaration's input a wire struct of its flags' names.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[042](../../../.contracts/042-cli-command-reference-generation/CONTRACT.md) for the reference.

## Use

The CLI reads `COMMANDS`, `helpLines` and `commandReference`, and the deploy program its command words. A new command
adds its declaration to its group's file, its run to the CLI's `RUNS` and its output schema to `COMMAND_OUTPUTS`;
`mise -C workspaces/core run reference` then writes `reference.json`.

## Never

- Never import a run or the CLI.
- Never rename a shipped command, flag or exit status (CP-08).

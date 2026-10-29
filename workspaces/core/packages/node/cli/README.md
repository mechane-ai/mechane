# @mechane/cli

The `mechane` command: its invocation and settings, the output it writes and the failures it reports, and the run of
each command beside the login's and the self-update's.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/main.ts`: runs one invocation and ends with its status.
- `src/invoke/`: decodes the invocation, prints the help or the release, and runs the named command.
- `src/settings/`: the command line and the environment, read once into the invocation.
- `src/output/`: each result and error record in the invocation's output mode, through `@mechane/program`.
- `src/failures/`: the one message table, gathered from the tables of each failure's owner.
- `src/runs/`: `RUNS`, one run per command, and one folder per resource for the runs that call it.
- `scripts/reference/`: the command reference that `reference.json` commits.

## Rules

The [product contracts](../../../.contracts/index.md) apply, with
[042](../../../.contracts/042-cli-command-reference-generation/CONTRACT.md) and
[043](../../../.contracts/043-cli-output-channels/CONTRACT.md) for the reference and the output.

## Use

`mise run mechane -- <command>` runs it from source; `mise -C workspaces/core run build:cli` compiles the binary. A run
returns `{ lines, result }`, and the output module encodes the result with the command's schema.

## Never

- Never read the command line or the environment outside `settings/load-invocation.ts`.
- Never encode a result in a run, or write a result or an error record outside `output/`.

## Split seam

`src/runs/observe/` and `src/runs/drones/` are the next member: they read a mech's events, trace, memories, threads and
drones, and share only `withWorkspace`, which would join `@mechane/cli-login`, and the kernel.

---
name: cli-command-reference-generation
message: Declare each command once in a model that drives both the CLI parser and its published reference.
paths: ["packages/node/cli/**"]
---

## Rules

Declare every command, subcommand, argument, option, default value, and help text once, in one command model.
Build the executable's argument parser from that model.
Generate the published command reference from the same model.
Do not maintain a second command catalogue, such as a hand-written reference page or a separate list of commands, options, or defaults.
Declare the defaults the program applies, such as the default server address, in the model rather than in runtime code.
Take the version the program reports and the version recorded in the reference from one declaration.

Keep network clients, credential storage, update checks, filesystem reads, and command execution out of the command model.
Resolve the content a parsed argument points to, such as a file or standard input, in runtime code after parsing.
Limit the model's dependencies to declaring and serializing commands.
Generate the reference with a generator that depends only on the model, without building or running the full program.
Publish the reference as data with a declared schema, so documentation consumers read it without depending on the program or its build toolchain.
Fail checks when a committed copy of the reference differs from the model's current output.

Preserve command names, argument names, defaults, help text, version metadata, and the reference schema when refactoring the model, unless a product change explicitly changes them.

## Checks

Generate the reference and compare it with the program's help and version output for representative commands.
Review the generator's dependency closure, and confirm it excludes the full program and network, credential, filesystem, and execution libraries.
Search the repository for command names, options, or defaults declared outside the model.
After changing the model, diff the generated reference and confirm each changed name, default, or help line comes from an intended product change.
Build each reference consumer without the program's build toolchain.

## Local adaptations

The command model is `packages/node/commands/src`, and the CLI's parser and `--help` derive from it.
The generator `packages/node/cli/scripts/reference/main.ts` imports only the model and writes `packages/node/cli/reference.json`, whose `schema_version` the model declares.
`mise -C workspaces/core run reference` writes the reference, and `mise -C workspaces/core run reference:check` fails when the committed copy differs from the model's output.
Its `release` comes from `RELEASE` in `@mechane/protocol`.
A release's binary reports the release its stamp holds, and `release:cli` stamps `RELEASE`, so the binary, `--help` and the reference agree; only the smoke stamps two test releases of its own.
`update` calls no catalog operation. The `--version` flag declares the command word `version`, which the reference publishes as the flag's `command`: it reads no deployment, so the settings carry it out beside the flag rather than as a command that calls an origin.
The model is to name each command's output schema, which the output module encodes once, so a run returns its result unencoded: ast-grep `encode-in-runs` ratchets an encode in `packages/node/cli/src/runs` and in the eval runner, `packages/node/eval/src`, until the declarations name it.
`eval run` declares every operation its trials call, and the reference lists the exit status `Interrupted`, 130, which it ends with on Ctrl-C.
The model declares `ErrorCode`, the code of each failure the CLI reports under its own name, and the reference lists them as `error_codes`; every report of such a failure takes it as a `ReportInput`, whose failure's tag must be one of them, so a code the model does not declare fails to compile.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `encode-in-runs` (CP-03): a ratchet until phase F2

<!-- End of the generated block. -->

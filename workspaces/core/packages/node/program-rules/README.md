# @mechane/program-rules

The registry's entries of the contracts of what programs do: shared code, settings, entry points, diagnostics,
lifecycles and the CLI, then data, tests, security and evals.

Layer 2 · node lane · data dialect · consumers: `@mechane/rules`

## Layout

- `src/programs/`: shared code, settings, entry points, diagnostics, lifecycles, concurrency and the CLI's output and
  reference, gathered as `PROGRAM_CONTRACTS`.
- `src/data/`: stores, record identifiers, stored formats and APIs, gathered as `DATA_CONTRACTS`.
- `src/test-rules/`: the smoke's scenarios and support, gathered as `TEST_CONTRACTS`.
- `src/security/`: keys, credentials, sessions, secrets and access, gathered as `SECURITY_CONTRACTS`.
- `src/evals/`: the eval runner's contracts, gathered as `EVAL_CONTRACTS`.

## Use

Change a value or a rule in the module of the contract it serves, named for the contract's folder, such as
`code-execution-lifecycle.ts`, then run `mise run fix`.

## Never

- Never import another rule-group member. `@mechane/rules` gathers the groups, and a shape they share belongs in
  `@mechane/rule-shapes`.
- Never edit a generated file to change a rule; change its entry here.

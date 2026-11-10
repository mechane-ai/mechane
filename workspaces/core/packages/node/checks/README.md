# @mechane/checks

The checks program: the owned checks with the registry's examples, lint, the baselines' tightening and merge, the
fingerprint, the changed set, the rules' measurement, the locks' append, and the fixers.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program, its settings, one run per command, the owned checks' run and the baselines' tightening.
- `src/examples/`: each owned rule's `violation` and `allowed` examples, run in memory as its check runs.
- `src/tool-examples/`: each oxlint rule's examples and each ast-grep fix's `fixed` example, run through the tool.
- `src/rewrites/`: each normalizer's rewrites, run in memory until they settle.
- `src/measure/`: every rule's findings, status and phase, and the pending list.
- `src/fixers/`: each enforced normalizer and autofix, and one rule's sweep.
- `src/fingerprint/`: the hash of each role's bundle and of the smoke's other inputs.
- `src/selection/`: affected check selection and the last full check's guarantee evidence.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[110 rule-registry](../../../.contracts/110-rule-registry/CONTRACT.md) holds every rule this program runs.

## Use

```sh
mise -C workspaces/core run checks
mise run fix
```

Each mise task names one command, such as `check`, `lint`, `tighten`, `fingerprint` or `fix`. The `affected` command
prints the affected tasks with mise's `:::` separators; diagnostics go to standard error.

The fast check reuses a full check's evidence only when its guarantees, dependency inputs, fixtures, configuration,
toolchain, and existing artifact bytes match. Added and removed file paths participate in the identity. Missing
artifacts request their checks. Selection reads the import graph and package dependency closure without bundling every
executable. An affected runtime requests the complete approved smoke catalog.

The complete check runs the existing minified `fingerprint` task after builds and before smoke, then recomputes and
records the evidence after every task passes. Worker roles use the production compiler's platform modules and resolution
conditions. The same `fingerprint` command remains the proof for mechanical source changes; it does not perform fast
selection.

## Never

- Never read the command line or the environment outside `load-checks-settings.ts`.

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
- `src/selection/`: affected check selection and exact successful target receipts.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[110 rule-registry](../../../.contracts/110-rule-registry/CONTRACT.md) holds every rule this program runs.

## Use

```sh
mise -C workspaces/core run checks
mise run fix
```

Each mise task names one command, such as `check`, `lint`, `tighten`, `fingerprint` or `fix`. `affected` only prints the
plan; `run-affected` invokes its selected targets through `run-target`. Diagnostics go to standard error.

The fast check reuses each target's own successful receipt only while its guarantee, dependency and package inventory,
fixtures, configuration, toolchain, and actual artifact bytes match. Each cache hit hashes the existing artifacts. Added
and removed file paths participate in the identity. Missing artifacts or malformed receipts request another run. Unknown
smoke import shapes include all smoke sources conservatively. Selection reads dependencies without bundling every
executable.

Each target wrapper captures inputs after its build prerequisites, runs the check, and records success only if those
same identities still hold afterward. It invalidates old evidence before rerunning. A later unrelated target failure
does not erase an earlier success. Filtered scenario arguments are forwarded structurally and remain uncached.

Affected smoke families run separately; selecting every family runs the complete catalog once. A successful complete
smoke can populate family receipts, but a planned declaration cannot. Local receipts never qualify publication. Final
release acceptance runs the complete retained catalog against one frozen artifact candidate.

The existing minified `fingerprint` task remains available for mechanical source changes and the complete source graph.
Worker roles use the production compiler's platform modules and resolution conditions. It does not perform fast
selection.

## Never

- Never read the command line or the environment outside `load-checks-settings.ts`.

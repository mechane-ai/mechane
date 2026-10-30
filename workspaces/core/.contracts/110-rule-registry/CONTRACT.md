---
name: rule-registry
message: Declare each value and rule a tool enforces once, in the rule registry, and generate every configuration from it.
paths: ["packages/node/rules/**", "packages/node/rule-shapes/**", "packages/node/*-rules/**", "packages/node/rule-generator/**", "lint/**", "sgconfig.yml", "**/tsconfig.json", "tsconfig.*.json", ".oxlintrc.json", ".dependency-cruiser.cjs", "knip.jsonc", ".jscpd.json", ".oxfmtrc.json", ".gitattributes", ".contracts/*/assets/**"]
---

## Rules

The rule registry, `@mechane/rules` in `packages/node/rules`, holds every value and rule a tool enforces, in one module per contract, and a contract without an entry fails to compile.
The registry generates every tool's configuration, each contract's enforcement block, the ast-grep utilities and tests, each lane's strict globals and the workspace's `.gitattributes`; change the registry and run `mise run fix`, never the generated file (AS-03).
Write every message as an imperative fix, an example in code and the rule it serves, such as "Name it, such as `const isReady = true` (NM-07)", with no period at its end or inside: each ast-grep and restricted message, each dependency-cruiser comment, and each finding of an owned check or of the registry's own checks (AS-01, ER-11).
Set every rule to error or off, never to a warning, and let no rule expire on a date (AS-04).
Give each rule a suppression budget, 0 unless its entry says otherwise and never above three; a rule that needs more is reworded (AS-02).
Give each ast-grep and owned rule at least one violation and one allowed example, each ast-grep rule with a fix what the fix leaves of each violation, each nursery oxlint rule a violation and an allowed example, and each normalizer at least one rewrite, which run as its test, and no path pattern that matches no file, since such a rule could never fail (TS-05, TS-09).
Give each rule its fix, by oxlint, by ast-grep, by a codemod or by hand, and that fix's behavior, `type-only`, `binding-names`, `field-names` or `restructure`, which sets its commit's proof; a sweep of a `field-names` or `restructure` fix leaves the `unexercised` globs, the code no check runs, as they are (TS-07).
Roll each rule out with a status and the phase that sweeps it; a rule whose sweep does not land the day it is approved is a ratchet, whose generated baseline only shrinks (AS-05).
Never fix by hand a finding that an enforced rule's autofix covers: `mise run fix` writes the registry's files, runs each enforced normalizer, applies the enforced oxlint and ast-grep fixes, formats every file and tightens the baselines, in that order (AS-06).
Rename a binding with `mise run rename -- <from> <to>`, which renames its `Input` type, its span name, its file and every import with it (AS-06).
Never let fix replay a committed rename map, whose wire strings change behavior by design; `mise run rename` with no names replays the maps, once, on a branch cut before them (TS-07).
Keep each word list a sorted text file with one word per line, which any change may extend, a merge unites, and `mise run fix` sorts again (AS-07).
Leave the registry's source, its limits and budgets included, and `dependencies.json` to their owner through CODEOWNERS, and the word lists, the generated lint folders and the baselines to every builder, whose changes the checks decide (AS-07).

Violation: a contract's adaptations restate `functionLines` as 30, so a change to the registry leaves the sentence stale.
Allowed: the adaptations name `functionLines`, and the generated block states its value.

## Checks

From `workspaces/core`, run `mise run rules:check`, which fails on a generated file that differs from the registry, on each finding of the registry's own checks, and on an ast-grep rule that misjudges one of its examples.
`mise run rules:check` also fails on an ast-grep rule whose fix differs from its rule file's, whose severity is not `error`, or whose `ignores` lack a file of a role its entry exempts.
It fails too on a lint file that carries the generated mark though the registry no longer generates it, which `mise run fix` deletes (AS-03).
`mise run check` runs each owned rule on its examples and each normalizer on its rewrites through `checks`, and fails on one it misjudges, one without examples, and a finding of an example that lacks AS-01's form.
`mise run rules:measure` fails where a rule's status, an oxlint rule's fix or the opt-out list disagrees with what the tree and oxlint report.
Does a new value belong in the entry of the contract that asks for it, and does the contract's prose name it by its key?

## Local adaptations

The registry is seven members under `packages/node`, so no package passes ST-17's budget.
`rule-shapes` holds the shapes every entry is built from.
`structure-rules`, `typescript-rules`, `name-rules`, `program-rules` and `local-rules` hold the contracts' modules, by the groups of the contract index.
`rules` gathers them into `CONTRACTS` and renders every generated file, which `rule-generator` writes.
The registry's own checks run in the generator, `packages/node/rule-generator/src`: they read each ast-grep rule file and every file of the workspace, and count each rule a suppression of a TypeScript file names.
`rules:explain -- <rule>` and `rules:for -- <path>` print what the registry holds for a rule or a path.
Fix keeps the standard's order but for two steps. The registry's files come first, since every later step reads the configurations they hold, and oxfmt follows the oxlint and ast-grep fixers, so that their rewrites leave formatted code.
A normalizer is a registry rule of its own kind, which a sweep runs, such as `mise -C workspaces/core run sweep -- placement`, and fix once it is enforced.
A normalizer's dry run is its detector: `rules:measure` counts its sites, and once its entry is a ratchet or enforced, the owned checks hold them as they hold an owned rule's.
`check:fast` reruns the fix in check mode by its parts (AS-06): `rules:check` for the registry's files, the changed set's `oxfmt --check` and lint for the enforced oxlint and ast-grep fixes, and the owned checks for the normalizers and each baseline above its count.
An owned rule's example is a small tree of files, each file's text by its path, which a run in `packages/node/checks/src/examples` decides with the rule's own functions.
A normalizer's rewrite is such a tree and the tree the normalizer leaves of it: `packages/node/checks/src/examples` runs the tree through the normalizer in memory, round after round until one changes nothing, as `mise run fix` runs it over the workspace.
The owned rules over the import graph, the history, the registry, the protocol's schemas or a value copied across the factory, `baselines`, `locks`, `orphans`, `packages`, `pins`, `record-forms` and `rules`, carry none, since no small tree shows them; their contract's planted mutation proves them.
A dependency-cruiser rule's findings count under its own name, and like an oxlint built-in it relies on its tool's tests.
The registry also writes the factory's `.oxfmtrc.json`, from the formatter's options, and the factory's own `.gitattributes` marks it generated.
An ast-grep rule's entry names the file roles it exempts, since a rule file cannot read a role, and its `ignores` must hold each of their globs.
An owned check's finding ends with its rule's rule of the standard, which the checks add from the registry, and a finding of the registry's own checks that serves no rule of the standard ends with `(110)`.
Each tool's defaults give a rule a fix by hand that restructures, and an entry names its fix and behavior only where they differ.
`rules:measure` runs oxlint, so it compares each oxlint rule's fix with the one `oxlint --rules` reports.
A normalizer restructures, so it leaves the `unexercised` globs in fix as in a sweep, while an enforced rule's oxlint or ast-grep fix applies everywhere, since only new code still holds its findings.
An enforced rule's fix leaves code that compiles: where oxlint's fix of `unicorn/prefer-set-has` writes a `Set` under the array's `ReadonlyArray` type, which ST-33 requires, the ast-grep fix of `set-collection-type`, which runs after it, types the set `ReadonlySet`.
`baselineHold` is `per-file`: `checks` holds each file's count to the merge base's.
A change that splits files and moves functions may set it to `total`, as the code-style cleanup of contract 111 did until its close: `checks` then holds each ratchet's total to the merge base's, so a split or a moved function takes its sites to the file it lands in while a new site still raises the total.
Under `total`, `mise run fix` writes the tree's own counts while their total stays within the ceiling's, and each file's smaller count otherwise, so the lint still names each file that rose; the lint's hold of each file to its baseline, the merge driver and every other check stay enforced.
Tenet installs the tool files a contract ships under `assets/`, read-only and locked in `.tenet.lock`, which `mise run contracts:check` verifies.
The registry loads each adopted one in place, never a copy: an entry names the installed oxlint file or ast-grep rule folder in its `asset` field, by its path from the contract's folder.
The generator adds the folder to `sgconfig.yml`'s `ruleDirs` and the file to `.oxlintrc.json`'s `extends`, and the entry's examples become the ast-grep tests that run against the shipped rules (TS-05).
An asset rule keeps the library's message, which the lint prints with its period dropped and the entry's standard appended, such as `(ER-04)` (AS-01).
Its `ignores` are the library's, so an asset entry declares no exempt role, and the registry's checks of a rule file's message and `ignores` read only the authored ones.
An oxlint asset entry states the value its file sets, which the measurement, the fixers and the rule's examples write in place of the file, and `rules:check` fails where the two differ.
`rules:check` also fails on an asset the lock does not list for its contract, on a TypeScript rule of a loaded folder or a rule of a loaded oxlint file that no entry registers, and on an entry its file lacks.
One running entry per rule, and no opt-out of a running rule, keep `.oxlintrc.json` from setting a second value for a rule an asset configures.
An authored rule that copies a shipped one, such as `nested-call`, names the copied file and its locked hash in `derivedFrom`, and `rules:check` fails once the lock's hash differs, until the copy is reviewed and pinned again.
Each contract that ships an asset says in its adaptations whether the lint loads it, and if not, which rule enforces what it configures.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `unexercised` `packages/worker/edge/src/routing/peer.ts`, `packages/worker/sandbox/src/providers/container-provider.ts`, `packages/node/release/src/main.ts`, `packages/node/release/src/load-release-settings.ts`, `packages/node/release/src/print-source-release.ts`, `packages/node/release/src/clean-revision.ts`, `packages/node/release/src/build/build-source-release.ts`, `packages/node/stack/src/dev/**`; `baselineHold` per-file.
- owned check `rules` (AS-01): enforced in phase C2

<!-- End of the generated block. -->

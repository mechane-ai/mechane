---
name: code-lint-suppressions
message: Suppress a lint or check finding only at the one site it reports, with the rule's name and a reason, and fail checks on every suppression that suppresses nothing.
paths: ["**/*.ts", ".oxlintrc.json", "knip.jsonc", ".jscpd.json", "sgconfig.yml", "lint/**"]
---

## Rules

A suppression is any comment, attribute, tag, marker, or configuration entry that makes a lint, a compiler, or a repository check accept a finding that its rule reports.
Apply these rules to every suppression in source, tests, scripts, and check configuration, whichever tool reads it.
A contract may forbid suppressing one of its rules, and then no form below passes that rule.

Suppress a finding only at the site the tool reports: the reported line, the smallest statement or item that the tool honors there, or the one declaration, block, or path that the finding names.
Name every rule that a suppression silences, and never write a suppression that names no rule or silences every rule; a directive whose tool accepts no rule's name, such as a compiler's expected-error comment, names its rule by stating in its reason the one finding it accepts.
Give each suppression a reason that says why this site cannot follow the rule and names the system or source that keeps it from doing so, such as the provider that names a wire field, the dependency that declares a set, or the generator that writes a table.
Write the reason as behavior, never as a contract's name or a review tool's finding, as `code-comment-attribution` requires, and never as a promise of a later fix.

Write the reason inside the directive or attribute when the tool accepts text there, such as after ` -- ` or in a reason argument.
When a tool's directive accepts no text after the rule's name, write the reason on its own comment line directly above the directive.
Use the expectation form, which fails once its finding is gone, instead of the allow form wherever the language offers both.
When the tool reports a block, such as a copied block, surround only that block with the tool's start and end markers, and write the reason on the start marker.
When the finding concerns a declaration's consumers, such as an export that only another repository imports, mark that declaration with the tool's documentation tag, and write the reason on the tag's own line.
When the finding reports no line, such as a folder over its file limit, add a configuration entry that names that one path and carries its reason in a comment beside it.
When a tool honors no suppression at a site it reports, the site follows the rule, and a configuration entry that skips that site by name is a violation.
Spell the directive of every check that the repository owns one way: the check's name followed by `-allow`, the rule's name, ` -- `, and the reason, on the line above the reported line.

A suppression that covers a whole file, module, or package, a rule turned off, a lowered severity, and an option or limit changed so that one site passes are violations.
A rule turned off with one of the reasons that `code-lint-strictness` lists, named in the comment above its entry, is not a violation.
A path pattern that a contract declares in the lint configuration, such as a settings module, generated files, or test fixtures, scopes a rule and is not a suppression, and widening it to admit one site is a violation.
Configure every tool to fail on a suppression that no longer suppresses a finding, wherever the tool supports it.
Make every check that the repository owns fail on its own directive once that directive suppresses nothing.
Configure the lint to reject a suppression that names no rule or gives no reason, in every directive spelling that the tool honors, wherever a lint rule can decide it.

Violation: `// lint-disable-next-line -- legacy` above a long function names no rule, and its reason does not say why that function needs the exception.
Allowed: a directive above a generated function names the function-length rule and gives the reason ` -- the generator writes one case per status code that the provider documents`.

## Checks

From the repository root, run each lint and check with its unused-suppression setting, and confirm that a stale suppression fails.
For each suppression a change adds, does it sit at the reported site, name each rule it silences, and give a reason that names the system or source that keeps the site from following the rule?
For a tool that cannot report a stale suppression, does each suppression that a change keeps still cover a finding?
For each configuration entry or path pattern a change adds or widens, does it name one path with a reason, or scope a rule as a contract declares?
Does a change turn a rule off without a reason that `code-lint-strictness` lists, lower its severity, or change an option or limit so that one site passes?

## Local adaptations

Directive forms: `// oxlint-disable-next-line rule -- reason`, which names every rule that reports its one site, as the two of `wireKeys`' type assertion do; a reason comment, or the doc comment that states the reason, on the line above `// ast-grep-ignore: rule`; `// jscpd:ignore-start -- reason` with `// jscpd:ignore-end`; `/** @public -- consumer */` for knip; a knip ignore entry with a reason comment beside it.
Unused directives fail: oxlint through `reportUnusedDisableDirectives`, ast-grep through `--error=unused-suppression`, and knip through `treatConfigHintsAsErrors`.
ast-grep `suppression-form` rejects a malformed directive, oxlint `unicorn/no-abusive-eslint-disable` a directive without a rule, and `typescript/ban-ts-comment` every `@ts-` directive.
The owned checks of `mise -C workspaces/core run checks` honor no suppression, so a site they report must comply; a suppression of the next line between a declaration's doc and its code leaves the doc attached.
Each rule's entry declares its suppression budget, `maxSuppressions`, 0 by default and at most `maxRuleSuppressions`; `rules:check` counts each rule that a suppression of a TypeScript file names, with or without its plugin, and fails on a rule suppressed more often than its budget allows. The rules with a budget above 0 are `consistent-type-assertions` and `no-unsafe-type-assertion`, for `wireKeys`, `sql-statement-not-literal`, for a fork's copy, `consistent-type-definitions`, for the two global augmentations, and `no-bitwise`, for three masks; their entries state each budget.
`rules:check` also counts each `// <check>-allow <rule> -- <reason>` against the owned rule's budget, which is 0, and each `// jscpd:ignore-start -- <reason>` against 035's `jscpdSuppressions`.
oxlint runs every rule of its `correctness`, `suspicious`, `pedantic`, `perf`, `style` and `restriction` categories. The opt-out list that ends `rules` in `.oxlintrc.json` turns off each rule that still has findings, which `mise -C workspaces/core run rules:measure` computes and fails on when the registry's list differs, and each rule off by decision, with its reason beside it; the registry holds both in `packages/node/name-rules/src/oxlint-opt-outs.json`.
The copied `licenses/*.js` assets contain only verbatim legal comments, which bundlers retain in distributed artifacts; the registry excludes this exact data-asset pattern from oxlint because it contains no implementation code.
A rule in rollout is a ratchet, and its generated baseline is no suppression: `lint/baseline/<rule>.json` maps each file to its count of the rule's findings, with sorted keys, a file it does not list has none, and no person edits it.
Each rule's entry in the registry declares its `status`, `proposed`, `ratchet` or `enforced`, and the `phase` whose sweep clears it, or `adopted` for a rule enforced before the standard; `rules:measure` prints both, and `rules:check` fails on an ast-grep rule file that no entry registers.
`mise -C workspaces/core run lint` runs oxlint once with `-f json` and ast-grep once with `--json=stream`, and `checks` runs the owned rules: an enforced rule fails on any finding, while a ratchet fails on a file above its count, naming each of its sites, or below it, as a stale suppression does, and prints its total.
`checks` holds every baseline to its version at the merge base with `MECHANE_BASE_BRANCH`, `main` when unset: a count above the merge base's, or a file it did not list, fails, so neither an edited nor a regenerated baseline admits a new site. CI fetches the full history and names the pull request's target branch.
110's `baselineHold` is `per-file`. A change that splits files may set it to `total`: `checks` then holds each baseline's total to the merge base's instead, and fix writes the tree's counts while that total holds.
`mise run fix` tightens every baseline to the tree, never above the merge base's count, which it carries across each rename `git diff -M` reports since then, a move made without git included, and across each rename the committed move map records, which a step's declaration moves can hide from git. The files that the map's declaration moves join pool their counts: while the pool's sum stays within the merge base's, each file may hold its own. A ratchet new on the branch never rises above its own baseline, its first baseline holds the tree's counts, and fix deletes a baseline that no ratchet declares.
A rule whose status is `proposed` runs, but only `rules:measure` counts its sites, and it keeps no baseline.
It refuses a baseline that empties, so the flip of its rule to `enforced` lands in the same commit.
A conflict in a baseline takes either side and runs `mise run fix`; the `merge=baseline-min` driver that `.config/bootstrap.sh` registers keeps each file's smaller count, and GitHub's merge button ignores it.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `maxRuleSuppressions` 3.
The generated configurations carry `oxlint`.
- oxlint `unicorn/no-abusive-eslint-disable` (AS-02): enforced, `"error"`
- owned check `baselines` (AS-05): enforced in phase C1
- ast-grep `suppression-form` (AS-02): enforced

<!-- End of the generated block. -->

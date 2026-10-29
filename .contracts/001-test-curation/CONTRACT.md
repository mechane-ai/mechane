---
name: test-curation
message: Treat development tests as disposable, and commit only checks that guard consequential regressions and declared example tests.
requires-tenet: 0.11.0
paths: ["workspaces/core/packages/node/smoke/src/**", "workspaces/core/packages/node/testing/src/**", "workspaces/core/**/package.json"]
---

## Rules

Apply this contract to added, changed, and removed tests, fixtures, and test-only dependencies; adopting it does not require deleting an existing suite wholesale.
A change that touches no test, fixture, test report, or test-only dependency leaves this contract unaffected.
Test freely during development with temporary tests, probes, broad cases, and manual checks, and treat their results as development evidence.
Keep temporary tests, probes, fixtures, and test-only dependencies out of every commit, including intermediate commits and commits pushed only to run CI, unless a retained check uses them.
Passing locally or catching the original bug does not by itself justify keeping a test.

Keep example tests as `test-example-suite` requires; they need no guarded regression to be retained and no reason or remaining protection to be deleted, but the rule below against hiding a regression still covers them.
Retain a new automated check only when it guards a concrete, consequential regression that existing checks miss and its outcome is stable and observable.
Consequential regressions include leaked credentials, lost or corrupted data, incorrect charges, repeated paid work, unbounded work, swallowed errors, and broken cancellation, recovery, or publication safety.
Name the guarded regression and the gap in existing coverage in the change description for each retained new check.
Apply the same retention standard to every kind of test; do not keep or reject a test because it is called unit, integration, end-to-end, or smoke.
Test each guarantee at the boundary that owns it, extending an existing representative flow when one reaches that boundary.

Leave structure and conventions to types, linters, contracts, and code review rather than tests.
Do not assert private helpers, internal data shapes, internal call counts, incidental copy, rendered snapshots, or behavior owned by a dependency.
Do not repeat a test per fixture or variant unless the variant changes the guarded behavior.
Keep distinct concerns in separate cases; do not merge unrelated scenarios to reduce the reported test count.
Treat sampled or model-graded scores as measurements, not exact expected values.
Apart from a declared example limit, do not set coverage-percentage targets, test-count targets, or test-count gates.

Removing or skipping a test, case, or assertion deletes the coverage it provided.
Delete existing coverage only for a stated duplicate, a superseded requirement, or behavior explicitly accepted as development-only verification, and name the protection that remains.
Never loosen or delete a check to hide a regression; difficulty, slowness, or an unfavorable result is not a reason to remove it.

Synchronize concurrent tests with explicit gates and bounded cleanup rather than sleeps.
Where the test runner takes a per-test timeout, give every test one as a number literal, only to bound a hung test, never to define expected ordering.
Fix a flaky test's fixture ownership or synchronization instead of raising timeouts, adding retries, or deleting the only protection against a critical failure.
Record live provider checks as separate evidence, and do not present a mocked provider as proof of live provider behavior.
Write temporary test reports and outputs outside tracked source.

## Checks

Inspect each commit, not only the complete diff, for temporary tests, probes, fixtures, reports, and test-only dependencies.
For each retained new check, can the author name the consequential regression, the gap in existing coverage, and why its boundary detects the defect?
For removed or weakened coverage, identify the remaining protection or the explicit acceptance of development-only verification.
Temporarily break the critical behavior a changed check guards, confirm the check fails for that reason, then restore the implementation and remove the probe.
Run the affected tests with the repository's standard test command.
Run the repository's lint and this contract's `assets/` configuration over its test files from the repository root, and confirm they fail on a test that declares no timeout.

## Local adaptations

The one retained suite is the smoke, `workspaces/core/packages/node/smoke/src/main.ts`, which drives the built CLI against fresh local stacks: Cloudflare workerd for runtime compatibility and `celld dev` for the remaining scenarios; run it from the factory root with `mise -C workspaces/core run smoke`.
A scenario exists only for a guarantee from the consequential list above that no scenario covers, and only after a maintainer approves its addition to the scenario catalog, `workspaces/core/packages/node/smoke/src/catalog.ts`.
Each catalog entry names its guarantee and the regression it guards; the pull request that adds it names the coverage gap.
The repository keeps no unit tests, no tests of check scripts, no test runner and no eval in `mise run check`.
Under the accepted code standard, every lint rule is shown to fail on the code it names (TS-05). Each ast-grep rule's registry entry carries at least one violation and one allowed example, which the registry writes to `workspaces/core/lint/ast-grep/tests` and `rules:check` runs with `ast-grep test`. A rule with a fix also carries what the fix leaves of each violation, which `checks` compares with the fix's output over a copy of each violation. A nursery oxlint rule's entry carries such examples too, which `checks` runs it over with type information.
Each owned rule's entry carries such examples as small trees of files, which `checks` runs through the rule's own decision in memory.
Each normalizer's entry carries rewrites, a small tree of files and the tree the normalizer leaves of it, which `checks` runs through the normalizer in memory.
An owned rule over the import graph, the history, the registry or a value copied across the factory, which no small tree shows, is verified once by mutation, reported in the pull request.
`rules:check` also fails on a file role's glob, an ast-grep rule's `files` glob, or the `path` a dependency-cruiser rule starts from that matches no file, since such a rule could never fail (TS-09).
A run against a real model, OpenRouter or Cloudflare is separate evidence that a person starts; `mise run check` never calls a paid model or a cloud account.
A smoke run keeps its state under the operating system's temporary directory, removes it after a passing run, and writes nothing into tracked source.

Mechane declares no example tests and does not install `test-example-suite`.
The smoke runs the built CLI as its users run it, which that contract classes as end-to-end, so the example allowance and the declared example limit name nothing here.
The registry's rule examples, which the checks run as each rule's test (TS-05), are admitted under the accepted code standard.
They check a rule, not product behavior, and are not `test-example-suite` examples.
A temporary test, probe or fixture stays out of every commit, a slice's intermediate commits and a commit pushed only to run CI included.

The shipped oxlint file targets Jest and Vitest, while this repository's one smoke runs through Effect and its own assertion functions.
It is installed for source tracking but not loaded; the smoke's existing scoped deadlines supply its hang bounds.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

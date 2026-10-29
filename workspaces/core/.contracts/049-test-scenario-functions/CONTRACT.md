---
name: test-scenario-functions
message: Give each scenario of an end-to-end check its own function named for the one guarantee it protects, and name every reported check without a sequence marker.
requires-tenet: 0.11.0
paths: ["packages/node/smoke/src/**", "packages/node/testing/src/**"]
---

## Rules

Apply this contract to every end-to-end and smoke check and to the main function that runs it, including a check that reports its result only through failed assertions and its exit status.
`test-curation` keeps distinct concerns in separate cases; this contract gives each of those cases its own function and name.
Give each scenario its own function named for the one guarantee it protects, such as `replayedOrderCreatesNoSecondInvoice`.
A scenario function is an independent operation even when the main function is its only caller.
Limit the main function to starting the shared environment, running each scenario function, stopping the environment, and mapping the scenarios' outcome to an exit status, and keep every request and assertion out of it.
Run two scenarios concurrently only when neither one writes state in the shared environment that the other reads or writes, such as a record, a counter, a queue, or the set of records a listing returns.
Name each reported check and test case for its guarantee alone, and never prefix it with a sequence letter, number, or step marker, such as `(a)`, `3.`, or `step 2:`.
In every test file, end-to-end or not, whose runner declares suites by a call, put every case and hook in one top-level suite, such as `describe('order export', ...)`.
Enforce the naming rule with the repository's lint over every check and test case name, and suppress a finding only as `code-lint-suppressions` allows.

Violation: a check is reported as `(c) a replayed order returns the same invoice`.
Violation: one scenario function, `exportAndCancel({ stack })`, checks the export listing and also cancellation.
Allowed: `main` runs `replayedOrderReturnsSameInvoice({ stack })`, which reports one check named `a replayed order returns the same invoice`.

## Checks

Run the repository's lint and this contract's `assets/` configuration from the repository root, and confirm that they report sequence markers in check and test case names.
Confirm that the same run reports a case or hook outside a top-level suite and a second top-level suite.
For each scenario function a change adds or grows, which one guarantee does it protect, and does its name state that guarantee?
Does the main function do any work besides starting the shared environment, running each scenario function, stopping the environment, and mapping the scenarios' outcome to an exit status?
For each pair of scenarios a change runs concurrently, does either one write state in the shared environment that the other reads or writes?

## Local adaptations

The scenario catalog `packages/node/smoke/src/catalog.ts` lists each scenario function with its guarantee and regression, and `main` runs each one after starting the stack, passing the entry's guarantee as the name of the scenario's check.
Scenarios run one after another, because each one reads the stack's one directory, and each signs in as an account of its own; a mech scenario counts only the scripted upstream's requests during its own turns, since the stack's model upstream is shared.
The mech scenarios run right after the deployment's, then the eval run's, the hands, cancel, memory, drone memory, drone report and crash scenarios, because a follower's last wait for an event ends only at its 20-second deadline and celld stops only once it has: each restart ends the waits before it. The operator's lists scenario follows them and restores the stack's lists with a last restart of its own, so every later scenario's bash still gets a machine; the auth scenarios, the burst among them, whose restart ends the waits before it too, and the release scenario follow. The token scan runs last.
ast-grep `check-name-sequence-marker` rejects a sequence marker in a check's `name` or a catalog entry's `guarantee`.

The shipped oxlint file targets Jest and Vitest suite calls; this repository uses neither, so the file stays unloaded.
Its one Effect smoke already owns each named scenario in the catalog, and no runner suite-call requirement applies.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- ast-grep `check-name-sequence-marker` (TS-03): enforced

<!-- End of the generated block. -->

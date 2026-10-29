---
name: test-support-modules
message: Declare each test helper and fixture once, in its own file of the package's test support folder, and never copy it into another test file.
paths: ["packages/node/smoke/src/**", "packages/node/testing/src/**"]
---

## Rules

Apply this contract to helpers and fixtures that tests, smoke checks, and test scripts use; a test file below is any file that only those checks run.
Declare one test support folder for each package, such as a `testing` folder beside the package's scripts or a `support` folder inside its tests folder.
Put each fixture server, fixture builder, and harness helper in that folder in its own file, named for its behavior, such as `start-process`, as `code-module-file-roles` requires.
Where a contract such as `code-typescript-module-boundaries` gives each folder an entry point, import every helper through the test support folder's entry point.
Declare a helper or fixture that two test files of one package use once in that folder, and import it from every file that uses it.
When tests of several packages need one helper, declare it once in a test support package that each of those packages depends on only for tests.
A helper copied into a second test file is a violation even when the copy was changed afterward, such as a process launcher that removes one fewer environment variable.
Two helpers that share a name but do different work, such as two fake providers that record different calls, are not copies and may stay in their files when each is named for its own work.
A helper or fixture that only one test file uses, such as building that file's seed records, may stay in that file.
`code-ownership-and-boundaries` keeps the test support folder out of production builds.
Enforce the copy rule with the copy detector that `code-duplicated-blocks` configures, and suppress a finding only as `code-lint-suppressions` allows.

Violation: two test files each declare `startProcess({ command })`, and only one of them removes the parent's credentials from the child's environment.
Allowed: both test files import `startProcess` through the test support folder's entry point, which re-exports it from the `start-process` file.

## Checks

Run the repository's copy detector over its test files and confirm that it reports no block copied between two files.
For each helper or fixture a change adds to a test file, does the test support folder or another test file already declare the same work under any name, including a copy with some steps changed?
For each helper a change adds to the test support folder, does it sit in its own file, named for its behavior?

## Local adaptations

The test support folder is `packages/node/testing/src`, one helper to a file named for its behavior, as this contract now requires.
Its folders group helpers by what they drive.
`cli` runs, refuses, starts and follows the built CLI, such as in `run-cli.ts` and `refused-cli.ts`, and `accounts` makes a scenario's account and reads its saved login.
`approvals` runs a command through its browser approval and signs a fresh account in.
`browser` signs a browser in at the local GitHub, sends and checks pages as a browser would, and approves by the notice's code.

`worker-log` reads and awaits the Worker's log lines, and `sentinels` reads files and finds leaked tokens.
`outcomes` writes each failure and maps the scenarios' outcomes to the smoke's status.
`mechs`, with its `events` folder, creates, holds and drives mechs, their turns and drones, and follows their events.
`check.ts` is the smoke's output module, and `fresh-folder.ts` makes a fresh folder in the stack's state folder.
The smoke imports every helper through `@mechane/testing`'s `src/index.ts`, its one entry point, and the package's own files import each other by path (ST-09).

A fixture only one scenario uses stays in that scenario's folder: the hands scenario's bare repository in `packages/node/smoke/src/hands`.
The smoke shares `packages/node/stack/src` with `mise -C workspaces/core run dev` instead of copying it, and jscpd scans both with the rest of `packages`.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `tests-outside-production` (050): enforced: Import the smoke and its testing support only from each other, such as `packages/node/testing/src/cli/run-cli.ts` from `packages/node/smoke/src`

<!-- End of the generated block. -->

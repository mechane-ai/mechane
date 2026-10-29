---
name: code-dependency-boundaries
message: Declare which packages each package may depend on once, in configuration that checks enforce, and keep that declaration acyclic and exact.
paths: ["dependencies.json", "**/package.json", "**/*.ts"]
---

## Rules

An internal dependency is a dependency of one package on another package of the same repository, such as a workspace member or a path dependency.
Declare the internal dependencies of every package and application once, in one configuration file that the repository's checks read, and name that file in the nearest package contract.
Give each entry in that declaration a one-line statement of what the package owns.
List every member package in the declaration, so that a new package fails checks until its dependencies are declared.
Fail checks on any internal dependency the declaration does not list, whether it arrives through a manifest entry, a package-name import, a relative import, or a re-export.
Fail checks on a declared dependency that no manifest uses, so that an edge enters the declaration in the same change as the first import that needs it.
Keep the declaration acyclic, directly and through intermediate packages.
Count every declared edge toward acyclicity except an edge through which only tests reach a test support package that `test-support-modules` requires.
Mark each such edge as test-only in the declaration, so that checks fail when production code uses it.
Allow a new internal dependency only by adding it to the declaration, never by suppressing a finding.

Violation: the `ledger` package adds `invoices` to its manifest to reuse the `Amount` type, while the declaration lists `ledger` as a dependency of `invoices`.
Allowed: `Amount` moves into `ledger`, which `invoices` already depends on, and the declaration is unchanged.

## Checks

Run the repository's checks from the workspace root, and confirm that they read the declared configuration file and fail on an undeclared internal dependency.
For each edge a change adds to the declaration, does it point from the composing package to the package it builds on, as the ownership statements say?
Should the change have moved the shared code into the lower package instead of adding the edge?

## Local adaptations

The declaration is in two places that hold no value twice: `dependencies.json` states each member once, with what it owns, its layer, lane, dialect, kind and criterion, and the members it allows to import it, and each member's `package.json` states its edges, each other member it depends on by `workspace:*`.
The workspace's members are its root and each folder that a glob of `pnpm-workspace.yaml` matches and that holds a `package.json`; the owned checks find them there, so a new member is checked from its first commit.
The boundaries check of `mise -C workspaces/core run checks` fails on a member `dependencies.json` lacks or names without a package, a `consumers` entry that names no member, and an import between members that its importer's `package.json` does not declare or that reaches the other member by relative path; knip fails on a declared edge that no import uses.
The layers keep the edges acyclic: each member's `layer:` rule lets it import only members of a strictly lower layer, so no cycle among edges can form, directly or through other packages.
No edge is test-only, and the check honors no suppression.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- owned check `packages` (ST-06): enforced

<!-- End of the generated block. -->

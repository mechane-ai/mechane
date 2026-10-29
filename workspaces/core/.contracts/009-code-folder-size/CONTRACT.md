---
name: code-folder-size
message: Keep every source folder within lint-enforced limits on its file count and depth, and name and justify each exempt folder in the lint configuration.
paths: ["**/*.ts"]
---

## Rules

Declare each package's source roots, including its test and script folders, a maximum number of files that share one extension directly inside one folder, and a maximum number of folder levels below a source root.
Count a folder directly inside a source root as its first level.
Enforce both limits with the repository's file-layout lint on every folder under a declared source root.
When a change would put a folder over its file limit, move the files that serve one behavior into a subfolder before adding the file, instead of raising the limit.
Name and scope each new subfolder as `code-module-structure-and-control-flow` requires for a module.
Exempt a folder only with the configuration entry that `code-lint-suppressions` requires for a finding that reports no line, such as for route segments that a framework requires.
Add a file to an exempt folder only when the system that the exemption's reason names requires that file there.
An exemption without a reason, an exemption that also covers the folder's subfolders, and a limit raised for every folder to admit one folder are violations.
Leave out of both limits, by a declared path pattern, folders whose entries are data rather than source, such as test fixture projects.

Violation: a change adds a file to `src/billing/`, which is at its file limit, and raises the limit for every folder.
Allowed: a change moves the four files that compute tax into `src/billing/tax/` before adding the new file to `src/billing/`.

## Checks

Run the repository's file-layout lint from the repository root.
For each change to the layout lint configuration, does it keep the declared limits, and does each new exemption name one folder with a reason specific to it?
For each file a change adds to an exempt folder, does the system that the exemption's reason names require that file there?

## Local adaptations

Source roots: the `src` and `scripts` folders of each workspace member, which the owned checks find from `pnpm-workspace.yaml`.
At most `folderFiles` files of one extension directly inside a folder, its TypeScript role files (such as `types.ts` or a concept's `drones.types.ts`) and the files a template fixes (such as `index.ts`, `main.ts` and `mech-object.ts`) aside, and at most `folderDepth` folder levels below a source root.
Deviation (ST-15, brought forward from phase E): a role or fixed file does not count toward `folderFiles`, so the role file the placement normalizer writes at a folder that holds every user never splits the folder; ST-15's values and its count of child folders land in phase E. For role and fixed files this replaces "a maximum number of files that share one extension directly inside one folder".
The layout check of `mise -C workspaces/core run checks` enforces both; no folder is exempt, and no data folder exists.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `folderFiles` 12; `folderDepth` 3.
- owned check `layout` (ST-15): enforced

<!-- End of the generated block. -->

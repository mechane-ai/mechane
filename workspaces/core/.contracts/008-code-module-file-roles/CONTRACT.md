---
name: code-module-file-roles
message: Give each source file one declared role and at most one class, component, and exported function, export only components from markup files, and split multi-role modules into folders.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Declare the file roles the repository uses, such as types, constants, schemas, errors, and behavior, and the file name that marks each role, such as `types` or `constants`.
Give each source file one role: a types file declares only types, a constants file only named constants, a schema file only validation schemas, and a behavior file only functions and classes.
Put a module's type declarations in a types file in the same folder as the code that uses them.
Put a module's named constants, such as limits, default values, and fixed lists, in a constants file in the same folder.
Keep functions out of a constants file: a named object, list, or lookup table whose values are functions is behavior and belongs in a behavior file.
A type derived from a schema or a constant, such as a schema's decoded type or the union of a constant object's values, may stay beside it.
A type that a framework convention expects beside its implementation, such as a user interface component's props, may stay in the component's file.
Keep a type that several modules share in the types file of the module that owns the concept, never in one repository-wide types file.

Declare at most one class and at most one user interface component in each source file, exported or not.
A module's error classes, such as tagged error classes, may share one declared errors file, and its schema classes one declared schemas file, each holding only those classes.
Export only user interface components, their props types, and declared framework names from a source file whose code holds markup, such as a `.tsx` or `.jsx` file.
Put the hooks, contexts, and constants that components share in source files without markup, so a development server can hot-swap a component file and keep its state.
Declare the names the repository's frameworks require a file to export, such as `generateMetadata` or `loader`, and count them toward neither the component-only nor the one-function limit.
A route, story, or test file, which a framework loads by its path, may keep its component unexported and export only what that framework loads, such as `Route`.
The shipped lint files list default framework names, skip `routes` folders and story and test files in the component-only lint, and a repository may add names and patterns.

When a module holds declarations of several roles, make it a folder named for the module with one file per role, such as `invoice-import/schemas`, `invoice-import/types`, and `invoice-import/parse-lines`.
Declare at most one exported function in each source file, so that operations other files call, such as building a command and parsing its output, sit in separate files.
An exported function is one that the file declares, or binds as a value to a name, for another file to import; re-exporting another file's function does not count.
A file may keep its exported function's private helpers, such as the function for one case of its branch, unexported beside it.
A namespace file, which an entry point re-exports under one namespace named for the file, may export several functions on that namespace's concept, such as `generate` and `validate`.
Exempt namespace files from the one-function limit by a declared path pattern that matches no other file.

Declare a maximum source file length in lines, and enforce it and the one-function, one-class, and one-component limits with the repository's lint.
Leave a language's limit on functions, classes, or components to review only by declaring the language and the reason beside the declared length.
Where the repository's lint can load this contract's `assets/` configuration, load it from the repository's own lint configuration, and turn on its markup plugin where code holds markup.
Suppress a finding only as `code-lint-suppressions` allows, and exempt generated files from these rules by a declared path pattern.

Violation: one invoice import module declares four validation schemas, the importer, and the line parser that reads them.
Violation: the `invoice-import/import-invoices` file exports both `importInvoices` and `parseLines`.
Allowed: an `invoice-import` folder holds `schemas`, `types`, `import-invoices`, and `parse-lines` files, and each one holds only its role.
Allowed: `uuid/uuid` exports `generate` and `validate`, `uuid/index` re-exports it as the namespace `Uuid`, and the declared namespace pattern matches it.
Violation: `use-invoice-dialog.tsx` exports only the `useInvoiceDialog` hook, which returns its open state and the markup of an unexported `InvoiceDialog` component.
Allowed: `use-invoice-dialog.ts` exports the `useInvoiceDialog` hook, which returns only its open state, and `invoice-dialog.tsx` exports only `InvoiceDialog`.
Violation: `invoice-list.tsx` declares the exported `InvoiceList` and an unexported `InvoiceRow` component that it renders.
Allowed: `invoice-row.tsx` holds `InvoiceRow`, and `invoice-import/errors.ts` declares both the `InvoiceRejected` and `InvoiceMissing` tagged error classes.

## Checks

Outside review-only languages, confirm the repository's lint run from its root reports an overlong file, a second exported function, and a second class outside errors and schemas files.
Run the repository's lint from the repository root and confirm that it reports a hook exported beside a component, and a second component, in a file with markup.
For each changed file, which declared role does it hold, and does any declaration in it belong to another role?
Does the change add a type, a named constant, or a schema to a behavior file?
For each function a change exports, including through an export list, a default export, or a call's result, is it its file's only one or in a namespace file?
For each path the declared namespace pattern matches, does an entry point re-export that file under one namespace named for the file?
Does each file with markup that a change touches export only components, their props types, and declared framework names?

## Local adaptations

Roles and their file names: `types.ts` holds types, `constants.ts` named constants with the types derived from them, `schemas.ts` Effect schemas with their derived types, `errors.ts` tagged error classes, `index.ts` is an entry point, `output.ts` is a program's output module, and `main.ts` is an executable.
A role file past the file limit splits by concept as `<concept>.<role>.ts`, such as `directory.schemas.ts` beside `schemas.ts` (ST-20).
In a folder, a role file imports only the roles before its own in the order `constants`, `schemas`, `errors`, `types`, or its own role, which a concept's role files share, and none of the folder's behavior files, so a type that a constant or a schema needs sits beside it (ST-34): the generated dependency-cruiser rules `role-order-constants`, `role-order-schemas`, `role-order-errors` and `role-order-behavior` reject each other import. The registry's `contract-names.ts`, a constant the generator writes, counts as no behavior.
Deviation (ST-34): a role file may import a behavior file of another folder, which the role-order rules do not read, since 51 such imports remain, 44 of them in the protocol, whose role files read the record helpers of `records`, such as `wire-struct.ts`; phase E's packages end them. This narrows ST-34's "No role file imports a behavior file" to the role file's own folder.
Deviation (ST-19, under the accepted strict code standard): a type, constant, schema or error that one file uses is declared, unexported, in that file, and one that several files use goes in the role file of the nearest folder that holds every user; a role file that would empty is deleted. This replaces "Put a module's type declarations in a types file in the same folder as the code that uses them", "Put a module's named constants ... in a constants file in the same folder" and a behavior file's "only functions and classes". The placement normalizer of `mise run fix` moves each declaration, and moves an unexported declaration that only other declarations of its file name together with them.
The owned `placement-blocked` ratchet of `mise -C workspaces/core run checks` holds each declaration the normalizer leaves out of place, and its finding names what blocks the move: an import cycle the move would close, a declaration it needs that its file does not export, the role order, a declaration it would land above, a name its destination binds otherwise, or the unexercised code that the normalizer leaves as it is (TS-07).
Deviation (ST-19): the normalizer leaves a declaration whose one user is an executable where it is written, in that `main.ts`, such as each program's exit statuses and message table, or in its folder's role file, since ST-31 holds a `main.ts` top level to declarations whose values do no work, which the normalizer does not judge.
A declaration file holds one exported declaration named for its file, such as `health.ts` for the `health` operation; every other file is behavior named for its primary export.
The file-names check of `mise -C workspaces/core run checks` fails on a behavior file that exports no name its stem spells; the Worker module, which the runtime loads by its default export, is exempt.
ast-grep `types-file-role` and `declaration-file-role` enforce the role files.
A behavior file holds one value: the one-value ratchet of `mise -C workspaces/core run checks` holds each export beyond the value its stem spells, and the types its stem names or that value derives, which never move to a role file.
Maximum file length: `fileLines` code lines, blank and comment lines aside, enforced by oxlint `max-lines` (ST-21, brought forward from phase E: the placement normalizer moves declarations with their docs into the files that use them, and a count of physical lines would split a file for its comments).
A package's `src/index.ts`, the smoke's catalog and each Durable Object's `<object>-object.ts` are bounded by a closed set instead, the package's surface, the scenarios a maintainer approves and the object's RPC catalog, so `max-lines` skips them by name (ST-21).
It skips the generated `.dependency-cruiser.cjs` too, which holds one `layer:` rule for each member of `dependencies.json`, so its length is the manifest's.
The owned `one-value` ratchet (ST-18) enforces the one-function limit and more. A behavior file exports one value of any kind, an `Effect.fn` constant included, so every second exported function fails it. SC-04 keeps cohesive private helpers beside that operation without a function-count limit. TypeScript is the one language the lint reads.
Deviation (ST-18): the lint does not load the shipped `exported-functions` rules, whose every site in behavior files `one-value` already reports. `one-value` skips role files, `index.ts`, `main.ts` and the files a template fixes, such as `catalog.ts`, `migrations.ts` and `<object>-object.ts`, which the shipped rules read, so review holds the one-function limit there. This replaces "Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration."

Mechane declares no namespace file and no namespace pattern, as SC-06 bans the namespace re-export, so the namespace-file allowance names nothing here.

The v11 one-class and component-only additions are outside the current adoption baseline at commit 94f2d0f.
ST-19 still places a single-user tagged error beside its caller, so several such errors can share a behavior file.
No JSX or TSX file is in scope, and the shipped oxlint file stays unloaded.
The existing placement and one-value checks remain authoritative for file roles.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `fileLines` 120.
- oxlint `max-lines` (ST-21): enforced in phase D, `["error",{"max":120,"skipBlankLines":true,"skipComments":true}]`
- owned check `file-names` (NM-20): enforced
- normalizer `placement` (ST-19): enforced in phase D
- owned check `placement-blocked` (ST-19): a ratchet until phase E
- owned check `one-value` (ST-18): a ratchet until phase E
- ast-grep `declaration-file-role` (ST-20): enforced
- ast-grep `types-file-role` (ST-20): enforced
- dependency-cruiser `role-order-constants` (ST-34): enforced in phase D: Move what the constants file needs from a later role file beside it, such as `type Phase` in `constants.ts`
- dependency-cruiser `role-order-schemas` (ST-34): enforced in phase D: Move what the schemas file needs from an errors or types file beside it, such as `type Kind` in `schemas.ts`
- dependency-cruiser `role-order-errors` (ST-34): enforced in phase D: Move what the errors file needs from a types file beside it, such as `type Step` in `errors.ts`
- dependency-cruiser `role-order-behavior` (ST-34): enforced in phase D: Move what the role file needs from a behavior file of its folder into a role file, such as `types.ts`

<!-- End of the generated block. -->

---
name: code-typescript-compiler-strictness
message: Type-check every TypeScript package under strict compiler settings that no file relaxes.
requires-tenet: 0.11.0
paths: ["**/tsconfig*.json"]
---

## Rules

Make every package's compiler configuration extend the one that `code-lint-strictness` ships, directly or through a base it extends, so every option that file sets applies.
Under `exactOptionalPropertyTypes`, an argument field declared `dueAt?: Date` may be left out, but a caller can never set it to `undefined`.
Without it, `dueAt?: Date` also admits an explicit `undefined`, which an `in` test still sees and which overwrites a default when spread over it.
Under `verbatimModuleSyntax`, an `import type` statement disappears and every other import statement loads its module, so the source shows each import's runtime effect.
Type stripping needs that, because it removes only imports marked `type`, and an unmarked type-only import would fail when the module loads.
Do not relax any of those options for a package, directory, or file to make a change compile.
Do not disable type checking for a file with `@ts-nocheck`.
Suppress a single expected error only with `@ts-expect-error` and a reason, never with `@ts-ignore`.
Type-check each package against its own compiler configuration, including its tests and scripts.

Configure the repository's lint to reject `@ts-nocheck`, `@ts-ignore`, and `@ts-expect-error` without a reason.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.

Violation: a package's compiler configuration enables `strict` and `noUncheckedIndexedAccess` but extends no shipped configuration, so `exactOptionalPropertyTypes` and `verbatimModuleSyntax` stay off.
Violation: a test folder's configuration disables `exactOptionalPropertyTypes`, which the package's configuration sets.
Allowed: every package's configuration extends a base that extends the shipped compiler configuration first, and the test leaves out `dueAt` for an invoice with no due date.

## Checks

Run each affected package's type check from its package root.
For each compiler configuration a change adds or edits, does the compiler's `--showConfig` output set every option that the shipped compiler configuration of `code-lint-strictness` sets?
Run the repository's lint from the repository root, and confirm that it rejects `@ts-nocheck`, `@ts-ignore`, and `@ts-expect-error` without a reason.

## Local adaptations

`tsconfig.base.json` sets each compiler option the generated block lists, three of them to false and `moduleDetection` to `force`, and the registry generates it with its other options.
Each lane has one program, `tsconfig.shared.json`, `tsconfig.worker.json` and `tsconfig.node.json`: it extends the base, sets only its runtime's `lib` or `types` from `lanePrograms`, names its lane's strict globals, which `code-typescript-effect-schemas` describes, and includes the source roots of every member whose `lane` in `dependencies.json` is its own, never a folder glob.
Each member's `tsconfig.json` extends its lane's program and includes only its own source roots, its `src` and `scripts` folders; the registry generates every one from the manifest, so `rules:check` fails on a configuration that differs.
`skipLibCheck` is on because Effect's declarations name the browser globals of other runtimes; every source file of the repository is still checked whole.
`mise -C workspaces/core run typecheck` checks each lane's program once, so every member is checked under its lane's types and none twice.
oxlint `typescript/ban-ts-comment` rejects every `@ts-` directive, so no expected-error form is in use.
oxlint `typescript/explicit-function-return-type` has every function and callback declare its return type, such as `(node): void => { lists.push(node.body); }`, except a function expression whose type the place it is passed to declares and the registry's exact list of inferred records factories under TD-04. Both native return-type rules use that same list; the factories' inputs and returned methods remain typed, and every other function retains its return annotation.
The Worker lane includes the pinned Node declarations for its `nodejs_compat` imports, including the GitHub signing client's `node:crypto`; the shared lane keeps only browser globals.
`erasableSyntaxOnly` makes an `enum` and a namespace that holds code compile errors, so a closed set is an `as const` object, as `code-closed-value-sets` says.

Deviation (110, TD-10): the registry generates the compiler settings rather than extending an unadopted code-lint-strictness asset.
It already enables strict, exactOptionalPropertyTypes, verbatimModuleSyntax and noUncheckedIndexedAccess, alongside the other strict settings below.
The shipped oxlint file stays unloaded because the existing ban-ts-comment setting is stricter and bans every directive.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `inferredRecordFactories` `connectionRecords`, `findingRecords`, `slackDeliveryProgressRecords`, `slackDeliveryRecords`, `slackOriginRecords`, `slackRecords`, `sourceGrantRecords`, `sourceRecords`, `watchRecords`, `workspaceRecoveryRecords`; `compilerOptions` `target` es2024, `module` nodenext, `moduleResolution` nodenext, `lib` [`es2024`], `types` [], `allowImportingTsExtensions` true, `noEmit` true, `skipLibCheck` true.
The generated configurations carry `lanePrograms`.
- compiler option `strict` (TD-10): enforced, `true`
- compiler option `noUncheckedIndexedAccess` (TD-10): enforced, `true`
- compiler option `exactOptionalPropertyTypes` (TD-10): enforced, `true`
- compiler option `erasableSyntaxOnly` (TD-10): enforced, `true`
- compiler option `noImplicitOverride` (TD-10): enforced, `true`
- compiler option `verbatimModuleSyntax` (TD-10): enforced, `true`
- compiler option `noUnusedLocals` (TD-10): enforced, `true`
- compiler option `noUnusedParameters` (TD-10): enforced, `true`
- compiler option `noImplicitReturns` (TD-10): enforced, `true`
- compiler option `noFallthroughCasesInSwitch` (TD-10): enforced, `true`
- compiler option `noPropertyAccessFromIndexSignature` (TD-10): enforced, `true`
- compiler option `isolatedModules` (TD-10): enforced in phase A, `true`
- compiler option `noUncheckedSideEffectImports` (TD-10): enforced in phase A, `true`
- compiler option `forceConsistentCasingInFileNames` (TD-10): enforced in phase A, `true`
- compiler option `allowUnreachableCode` (TD-10): enforced in phase C2, `false`
- compiler option `allowUnusedLabels` (TD-10): enforced in phase C2, `false`
- compiler option `moduleDetection` (TD-10): enforced in phase C2, `force`
- compiler option `libReplacement` (TD-10): enforced in phase C2, `false`
- oxlint `typescript/ban-ts-comment` (TD-10): enforced, `["error",{"ts-expect-error":true,"ts-ignore":true,"ts-nocheck":true,"ts-check":true}]`
- oxlint `typescript/explicit-function-return-type` (TD-09): enforced in phase D, `["error",{"allowExpressions":false,"allowTypedFunctionExpressions":true,"allowHigherOrderFunctions":false,"allowedNames":["connectionRecords","findingRecords","slackDeliveryProgressRecords","slackDeliveryRecords","slackOriginRecords","slackRecords","sourceGrantRecords","sourceRecords","watchRecords","workspaceRecoveryRecords"]}]`
- oxlint `typescript/explicit-module-boundary-types` (TD-09): enforced in phase D, `["error",{"allowedNames":["connectionRecords","findingRecords","slackDeliveryProgressRecords","slackDeliveryRecords","slackOriginRecords","slackRecords","sourceGrantRecords","sourceRecords","watchRecords","workspaceRecoveryRecords"]}]`

<!-- End of the generated block. -->

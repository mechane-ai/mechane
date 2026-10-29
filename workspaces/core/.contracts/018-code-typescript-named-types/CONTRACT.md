---
name: code-typescript-named-types
message: Name every TypeScript object type with a `type` alias instead of writing it inline, and write `interface` only to augment a dependency's declaration.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Declare every object type as a named `type` alias, such as `type Invoice = { id: string; total: number }`, never as an `interface`.
This holds for an empty or generic object type and for types in tests, scripts, and hand-written declaration files.
Never write an object type literal inline in a parameter, return type, property, type argument, union member, intersection, or variable annotation.
Name each nested object type and refer to it by name, so a property that holds an object has a named type of its own.
A type built from named types by a type operator or a utility type, such as `Pick<Invoice, 'id'>` or `Record<OrderStatus, number>`, is allowed.
A type inferred from a value, such as `typeof defaults`, is allowed, and a schema's derived type is referred to by the alias that `code-typescript-effect-schemas` requires.

Write an interface's `extends` clause as an intersection: `interface Order extends Audited, Owned { id: string }` becomes `type Order = Audited & Owned & { id: string }`.
An intersection that forms a whole alias may hold one object type literal, the members that the alias adds to its named types.
Write an empty interface that extends one type, such as `interface Shipment extends Audited {}`, as `type Shipment = Audited`, never as `{} & Audited`.
Drop an `extends Record<string, unknown>` that only made an interface assignable to a record, because an object type alias is assignable to one already.
A class implements a `type` alias of an object type as it would an interface, so an `implements` target is no reason to write `interface`.

Write `interface` only to merge members into a dependency's declaration, including a global one such as `Window`, because a `type` alias never merges.
That covers an interface inside `declare module`, such as `declare module 'job-queue' { interface JobData { orderId: string } }`, and one inside `declare global`.
Never merge members into a type that the repository declares; add them to its own declaration.
Suppress the lint finding on each augmenting interface only as `code-lint-suppressions` allows, with a reason that names the dependency and the type it declares.
Suppress it before applying the lint's automatic fix, which would turn the augmentation into a separate alias that no longer merges.
Exempt generated files and copied third-party source from these rules by a path pattern declared in the lint configuration.

Configure the repository's lint to reject every `interface` declaration.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.
Review what that configuration cannot see: object type literals written inline.

Violation: `buildCommand({ model, deadline }: BuildCommandInput): { readonly argv: readonly string[] }` declares its return object type inline.
Allowed: `buildCommand({ model, deadline }: BuildCommandInput): CommandLine` with `CommandLine` declared as a named type.
Violation: `export interface Order extends Audited { id: string }` declares an owned object type with `interface`.
Allowed: `export type Order = Audited & { id: string }`, and `interface JobData` inside `declare module 'job-queue'` with a suppression that names that dependency.

## Checks

Run the repository's lint from the repository root, and confirm that it rejects an `interface` declaration and accepts a `type` alias.
From the package directory, run the package's type check after renaming, extracting, or converting types.
Search the change for `{` in type positions: parameter annotations, return types, property types, type arguments, unions, and intersections.
Is each object type literal the search finds an allowed operator, utility, or inferred form, or the one literal of an alias's intersection?
For each suppression of this rule a change adds, does the interface sit inside `declare module` or `declare global` and merge into a type that the named dependency declares?
For each path pattern a change adds to exempt files from these rules, does it match only generated files or copied third-party source?

## Local adaptations

ast-grep `named-object-types` rejects an object type literal anywhere except as a `type` alias's whole value, or as the one object literal that joins named types in an intersection that is an alias's value, such as `type ReadInput = PageInput & { readonly line: string }` (TD-03).
Type syntax has one form each: oxlint `typescript/array-type` with `generic` for both forms writes `Array<T>` and `ReadonlyArray<T>`, `typescript/method-signature-style` with `property` writes a method signature as a property, `import/consistent-type-specifier-style` with `prefer-top-level` gives a type import its own statement, and `typescript/no-namespace` with `allowDeclarations` rejects a namespace but a global augmentation.
`typescript/consistent-type-definitions` writes each object type with `type`, and each of the two global augmentations, of `ImportMeta` and `Cloudflare.GlobalProps`, carries its one suppression, since only an interface merges into a global; `consistent-indexed-object-style` writes `Record` for an index signature, and `consistent-type-imports` gives an import used only as a type `import type`.
Each module's import has one form too: `import/no-duplicates` merges two imports of one module of the same kind, and `sort-imports` with `ignoreDeclarationSort` and `ignoreCase` sorts the names inside the braces, while the formatter sorts the statements.

The registry already enforces the shipped consistent-type-definitions setting as error with type, so the duplicate oxlint file stays unloaded.
The one-object-literal intersection allowance now matches v11 and needs no deviation.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `typescript/consistent-type-definitions` (TD-05): enforced in phase D, `["error","type"]`
- oxlint `typescript/array-type` (TD-05): enforced in phase A, `["error",{"default":"generic","readonly":"generic"}]`
- oxlint `typescript/consistent-indexed-object-style` (TD-05): enforced in phase D, `["error","record"]`
- oxlint `typescript/consistent-type-imports` (TD-05): enforced in phase D, `["error",{"prefer":"type-imports","fixStyle":"separate-type-imports"}]`
- oxlint `import/consistent-type-specifier-style` (TD-05): enforced in phase A, `["error","prefer-top-level"]`
- oxlint `import/no-duplicates` (TD-05): enforced in phase D, `"error"`
- oxlint `sort-imports` (TD-05): enforced in phase D, `["error",{"ignoreDeclarationSort":true,"ignoreCase":true}]`
- oxlint `typescript/method-signature-style` (TD-05): enforced in phase A, `["error","property"]`
- oxlint `typescript/no-namespace` (TD-05): enforced in phase A, `["error",{"allowDeclarations":true}]`
- ast-grep `named-object-types` (TD-03): enforced

<!-- End of the generated block. -->

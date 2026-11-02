# @mechane/modules

TypeScript source analysis shared by the checks, import rewrites, and renames.

Layer 3 · node lane · data dialect · consumers: the members of the checks

## Layout

- `src/`: the parser's node types, a parsed source, its lines and statement lists, and a normalizer's scope.
- `src/statements/`: each import and export statement of a module, the names it takes, and every file's exports.
- `src/edits/`: the edits that rewrite a module's statements, and the text they leave.
- `src/units/`: comment attachment when a rewrite changes a statement.

## Rules

The [product contracts](../../../.contracts/index.md) apply.

## Use

Every function here is pure: it takes a `ParsedSource`, and answers. The kernel reads and parses the sources, so this
package reads no registry and sits below every member that does.

## Never

- Never read a file, the environment or the registry here; take what a function reads as its input.

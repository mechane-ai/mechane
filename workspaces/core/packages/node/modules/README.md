# @mechane/modules

TypeScript modules as the checks read them: the parser's node types and the roles of module files, a parsed source and
its lines, and each module's statements, references and declarations, with the units a declaration moves as.

Layer 3 · node lane · data dialect · consumers: the members of the checks

## Layout

- `src/`: the parser's node types, the roles of module files, a parsed source, its lines and statement lists, and a
  normalizer's scope.
- `src/statements/`: each import and export statement of a module, the names it takes, and every file's exports.
- `src/edits/`: the edits that rewrite a module's statements, and the text they leave.
- `src/references/`: where a module names each declaration, with the spans of its types.
- `src/declarations/`: each top-level declaration of a module, its role and whether it may move.
- `src/units/`: the units a declaration moves as, with their comments, and the files that use each.
- `src/moves/`: where each unit belongs, what it needs where it lands, and the index of every module.

## Rules

The [product contracts](../../../.contracts/index.md) apply.

## Use

Every function here is pure: it takes a `ParsedSource`, or the index built from them, and answers. The kernel reads and
parses the sources, so this package reads no registry and sits below every member that does.

## Never

- Never read a file, the environment or the registry here; take what a function reads as its input.

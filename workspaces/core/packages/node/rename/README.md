# @mechane/rename

The rename codemod: one binding renamed with its input type, span name, file stem and every import, or the committed
rename maps replayed.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program, its settings, failures and exit, and the maps' three passes.
- `src/strings/`: the string pass, which rewrites each wire string in the factory's text files.
- `src/binding/`: the binding a name declares, its input type and its file.
- `src/identifiers/`: each occurrence of a renamed identifier.
- `src/files/`: the files the passes read and write, and a file named for its new export.
- `src/server/`: the TypeScript language server the identifier pass asks.
- `src/maps/`: the committed rename maps of wire strings.

## Rules

The [product contracts](../../../.contracts/index.md) apply.

## Use

```sh
mise -C workspaces/core run rename -- startStack launchStack
mise -C workspaces/core run rename
```

With no names, it replays each committed map once, as a branch cut before the map does.

## Never

- Never let `mise run fix` replay a map: a map renames wire strings, which changes behavior by design.

# @mechane/package-moves

The move codemod: the committed move map, applied through one step with each step's declarations, files, imports,
entries, manifests and every path a text names.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/`: the program, its settings and exit, the map `move-map.json`, a step's layout, and its file moves.
- `src/declarations/`: the declarations a step names, moved in rounds before its files move.
- `src/paths/`: each moved path rewritten wherever a factory text file names it.
- `src/package-imports/`: each import rewritten to the member that declares its names after the step.
- `src/package-manifests/`: each member's entry and manifest after the step, and the member manifest's rows.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[101 package-layers](../../../.contracts/101-package-layers/CONTRACT.md) holds the members a step adds.

## Use

```sh
mise -C workspaces/core run move -- checks
mise run fix
```

A step applies each earlier step first, and each skips what it finds done, so a parked branch replays the map.

## Never

- Never edit a step that has landed but to keep it equal to the manifest; add a step instead.
- Never hand-move a path the map names; replay the map.

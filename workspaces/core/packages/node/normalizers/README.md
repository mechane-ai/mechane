# @mechane/normalizers

The normalizers: the barrel, placement and blank-line rewrites, which declaration moves are feasible and where they
land, and each normalizer's sites and settled changes.

Layer 5 · node lane · effect dialect · consumers: package-moves, checks

## Layout

- `src/`: the normalizers by rule, their sites, their settled changes and a run over the workspace.
- `src/barrels/`: each import through a barrel taken from its declaring file, and the barrel removed.
- `src/placement/`: each declaration moved to the role file its users share, with the imports it needs (ST-19).
- `src/blank-lines/`: each statement that stands apart set off from its neighbors by a blank line (EF-24).
- `src/feasibility/`: which moves a round can make without stranding a binding, breaking the role order or a cycle.
- `src/graph/`: the file graph's import edges, and which moves keep it free of cycles.
- `src/landings/`: where moved declarations land in their destination.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[110 rule-registry](../../../.contracts/110-rule-registry/CONTRACT.md) holds each normalizer's status.

## Use

`mise run fix` runs each enforced normalizer through `normalize`, and the checks hold every other one's sites to its
baseline through `normalizerSites`. The move codemod reuses `feasibleMoves` and `moveChanges` for a step's declarations.

## Never

- Never write what a normalizer changes before it settles: it runs round after round until a round changes nothing.

# @mechane/boundaries

The members' boundaries: one dependency-cruiser cruise of every rule, each import held to its member's declared edges
and the member manifest, and the changed set that the cruise's module graph gives.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/`: the cruise and its module graph, the members' edges and manifest, and the changed set.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[101 package-layers](../../../.contracts/101-package-layers/CONTRACT.md) holds the layers, lanes and confines.

## Use

The checks cruise once with the rules the registry generates in `.dependency-cruiser.cjs`, and keep the module graph in
the cache. `mise run check:fast` reads that graph for the changed set: each changed file and every file that imports it.

## Never

- Never import dependency-cruiser outside this package; its `confines` names it.

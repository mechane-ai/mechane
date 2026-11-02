# @mechane/normalizers

The barrel and blank-line rewrites, their findings, and their settled changes.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/`: the normalizers by rule, their sites, their settled changes and a run over the workspace.
- `src/barrels/`: each import through a barrel taken from its declaring file, and the barrel removed.
- `src/blank-lines/`: each statement that stands apart set off from its neighbors by a blank line (EF-24).

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[110 rule-registry](../../../.contracts/110-rule-registry/CONTRACT.md) holds each normalizer's status.

## Use

`mise run fix` runs each enforced normalizer through `normalize`, and the checks hold every other one's sites to its
baseline through `normalizerSites`. Declaration placement is a module ownership decision.

## Never

- Never write what a normalizer changes before it settles: it runs round after round until a round changes nothing.

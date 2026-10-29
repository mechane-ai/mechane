# @mechane/checks-kernel

What every program of the checks shares: the workspace's files read, decoded and listed, git's and the tools' output,
the members and the move map, parsed sources, findings and sites, the linters' sites and each ratchet's baseline.

Layer 4 · node lane · effect dialect · consumers: normalizers, owned-rules, locks, boundaries, package-moves, rename,
checks

## Layout

- `src/`: the workspace's and the factory's folders, files read, decoded, listed and written, a moved path, a site's key
  and the findings, written as the program's result.
- `src/workspace/`: git's lines, the tracked files, the merge base, a tool's output and the members.
- `src/sources/`: each TypeScript file of the members' source roots, read and parsed once.
- `src/lint/`: the sites oxlint and ast-grep report, keyed by rule.
- `src/ratchets/`: the registry's ratchets and proposed rules, each ratchet's sites held to its baseline.
- `src/baselines/`: the merge base's baselines, the counts each file carries and may hold, and their merge.
- `src/baselines/moves/`: the move map, the paths it and git's renames move, and its declarations' pools.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[110 rule-registry](../../../.contracts/110-rule-registry/CONTRACT.md) holds the baselines.

## Use

A program reads its inputs through these functions and reports each `Finding` and `Site` they hold. `InputUnreadable`
and `FileUnwritable` are the only failures, and `ChecksFailure` names both.

## Never

- Never import a check or a normalizer here; they import the kernel.
- Never write a baseline by hand; `mise run fix` tightens them.

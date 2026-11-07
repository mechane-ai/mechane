# @mechane/release

Build the CLI binaries and download manifest for every supported target.

Layer 4 · node lane · effect dialect · consumer: distribution

## Layout

- `src/`: the program's settings, exit, and source revision.
- `src/build/`: one release built into a folder at its download paths, one binary compiled per target.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The distribution builder uses `buildRelease` to package
every supported CLI target with the same public source revision as the runtime.

## Use

`mise -C workspaces/core run release:cli` builds this source's release into `dist/release` from a clean tree.
[`@mechane/distribution`](../distribution/README.md) includes these binaries in the public release artifacts. This
package builds files; publication belongs to the release publisher.

## Never

- Never claim a revision other than the source used to compile the binaries.

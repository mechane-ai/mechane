# @mechane/release

Build the CLI binaries and download manifest for every supported target.

Layer 4 · node lane · effect dialect · consumers: stack, testing, smoke, distribution

## Layout

- `src/`: the program's settings and exit, source revision, and release file inventory.
- `src/build/`: one release built into a folder at its bucket keys, one binary compiled per target, and this machine's
  target.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The smoke uses `buildRelease`, `hostTarget` and
`releaseFiles` to exercise the CLI download and update protocol against a local stack.

## Use

`mise -C workspaces/core run release:cli` builds this source's release into `dist/release` from a clean tree.
[`@mechane/distribution`](../distribution/README.md) includes these binaries in the public release artifacts. This
package builds files; publication belongs to the release publisher.

## Never

- Never claim a revision other than the source used to compile the binaries.

# @mechane/release

Building the CLI's release for every target, and uploading it to the bucket its caller names.

Layer 3 · node lane · effect dialect · consumers: stack, testing, smoke, deploy-kernel, deploy

## Layout

- `src/`: the program's settings and exit, the release's files in their publish order, and the upload.
- `src/build/`: one release built into a folder at its bucket keys, one binary compiled per target, and this machine's
  target.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The smoke builds and publishes releases through
`buildRelease`, `hostTarget` and `releaseFiles`; the program's own commands and the upload run only on an operator's
host.

## Use

`mise -C workspaces/core run release:cli` runs `src/main.ts` to build this source's release into `dist/release`, from a
clean tree. The deploy program uploads it with `uploadRelease`. A `ReleaseFailed` names its `ReleaseStep`, which the
deploy program's steps include.

## Never

- Never upload a release whose manifest the bucket holds; a published release's files never change.
- Never run Wrangler without `EMPTY_DOTENV`, so no `.env` reaches its environment.

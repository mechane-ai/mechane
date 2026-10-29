# @mechane/cli-update

The `mechane` command's self-update: the latest release's binary, checked against its manifest and run before it
replaces the running one, and the update command's run.

Layer 5 · node lane · effect dialect · consumers: cli

## Layout

- `src/`: the `update` run, the update of a release's binary, its install over the running one, and the release the new
  binary reports.

## Rules

The [product contracts](../../../.contracts/index.md) apply. The update's failures live in `@mechane/cli-kernel`, since
every run's failure union names them.

## Use

The CLI's `RUNS` takes `runUpdate`. `mechane update` reports the latest release, and installs it unless `--check` asks
only for the report. A binary no release stamped, such as a run from source, refuses before it asks the deployment
anything.

## Never

- Never replace the running binary before the downloaded bytes have the manifest's size and SHA-256 and the new binary
  reports its release.

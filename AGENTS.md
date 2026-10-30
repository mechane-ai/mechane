# Working on Mechane

Read the [repository contracts](.contracts/index.md) and [product contracts](workspaces/core/.contracts/index.md) before
changing code. The product lives in `workspaces/core`. Its rule registry generates tool configuration and each
contract's enforcement block.

Run `.config/bootstrap.sh` on a fresh checkout. Use the pinned tools through mise:

- `mise run setup` installs locked dependencies.
- `mise run check` runs the complete check graph used by CI.
- `mise run fix` regenerates configuration and applies the repository's fixers.
- `mise run start` starts a persistent local installation.
- `mise run local:reset -- --confirm` erases an inactive local installation.
- `mise run dev` starts a disposable fixture with a scripted model.
- `mise run mechane -- --help` runs the CLI from source.

Declare protocol operations once. Keep the protocol and client independent of Node and Cloudflare imports. Declare
package members in `dependencies.json` and edges in each `package.json`.

Decode boundaries with Effect Schema. Run Effects at entry points and report tagged errors. Preserve deployed Durable
Object migrations and `/v1` formats.

The retained smoke suite drives built programs against local runtimes. Add scenarios only for consequential guarantees
under test curation. Do not add unit tests or mocks of Mechane code. Checks require no cloud credentials and call no
paid models.

This repository receives source snapshots from a private development repository. Changes must remain independently
buildable and preserve required legal attribution. Keep credentials and installation state outside source control.

The OpenTofu example contains no hosted installation identifiers. Infrastructure owns installation resources; agents and
workspace integrations are runtime API data. Publishing a snapshot does not authorize deploying a service or uploading
release artifacts.

# Working on Mechane

Read the [repository contracts](.contracts/index.md) and [product contracts](workspaces/core/.contracts/index.md) before
changing code. The product lives in `workspaces/core`. Its rule registry generates tool configuration and each
contract's enforcement block; change the registry instead of generated files.

## Commands

Run `.config/bootstrap.sh` on a fresh checkout. Use the pinned tools through mise from the repository root:

- `mise run setup` installs locked dependencies.
- `mise run check:static` checks source without runtime builds.
- `mise run check:fast` runs affected checks and reuses exact successful target results.
- `mise run check` runs the complete source graph.
- `mise run fix` regenerates configuration and applies the repository's fixers.
- `mise run dev` starts the retained local fixture with source reload.
- `mise run start` runs a retained local installation from source.
- `mise run dev -- reset --confirm` deletes an inactive local installation after successful shutdown.
- `mise run mechane -- --help` runs the CLI from source.
- `mise -C workspaces/core run TASK` runs a focused product task.

Follow the [local guide](workspaces/core/packages/node/stack/README.md) for prerequisites, qualified celld identity, and
resource lifetime. Local tests use the compiled Worker, real durable storage, Docker guests, and TLS Postgres.

## Ownership

Pi owns durable agent progression through its public APIs. Mechane owns notification admission, current authorization,
explicit publications, and effect receipts. Postgres owns shared control data. Sandbox storage and guests own machine
operations and committed files. Follow the
[runtime contract](workspaces/core/.contracts/124-durable-agent-runtime/CONTRACT.md); keep one execution owner and
preserve actual history, context, credentials, and files through migrations.

Declare domain operations once in the shared protocol. Keep the protocol and client runtime-neutral. Add package members
to `dependencies.json` and dependency edges to their manifests with the first consumer.

Use Effect Schema for domain boundaries and native schemas at SDK boundaries. Keep SQL in its owning store and errors
explicit. A native Promise or callback does not require an Effect wrapper solely for style. Keep credentials out of
serialized task state and inspection output. Public replies and reactions require explicit tools.

## Checks and delivery

Retain checks for consequential failures under [test curation](.contracts/001-test-curation/CONTRACT.md). Preserve
existing smoke coverage and follow its approval requirements before changing the scenario catalog. Checks call no paid
models or cloud accounts. Runtime candidate acceptance runs the complete retained catalog against one immutable build;
promotion reuses those bytes. A cached development result does not replace final acceptance.

Keep secrets and installation state outside source. Publishing artifacts, running paid models, and deploying services
require explicit operator authorization.
[Installation ownership](workspaces/core/.contracts/112-installation-ownership/CONTRACT.md) separates infrastructure
from runtime records. Record task-owned resources and release only those resources after final use. Preserve required
legal attribution in independently buildable contributions.

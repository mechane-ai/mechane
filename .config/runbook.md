# Installation

Deploy the qualified application Worker with its Console assets, Mech and Sandbox Durable Objects, container
application, and checkpoint bucket. Postgres holds shared control data; Pi and the Mech actor own durable execution. The
[self-hosting guide](../workspaces/core/docs/self-hosting.md) owns installation steps and database command inputs.

Keep one OpenTofu declaration, state, and deployment writer per installation. Select an immutable release and its
independently pinned qualification digest. Keep every referenced artifact, input, and evidence file beside the receipt.
The [Cloudflare module](../workspaces/core/infrastructure/modules/cloudflare/README.md) verifies the candidate before
uploading modules, Console assets, and the guest image.

Supply runtime database, OAuth, model, keyring, and service secrets through deployment references. Keep migration
credentials in controlled operator commands, outside Worker bindings. Preserve resource identities, keys, and backups.
Infrastructure applies do not create workspace members, mechs, or integration credentials.

Follow [operations](../workspaces/core/docs/operations.md) before changing releases or images. Fence execution, save
files, and require completed stop receipts, actual provider retirement, and capacity release. Historical import requires
positive retirement evidence and the reviewed source digest. Retrying the same import preserves immutable identities;
import never clears a maintenance hold or activates an actor.

After applying, require an empty follow-up plan and verify actual Console assets, notification execution, and a restored
sandbox command. Infrastructure convergence alone does not establish agent behavior.

Use the [local guide](../workspaces/core/packages/node/stack/README.md) for retained source development. Contributor
setup and checks live in [development setup](README.md). Keep `LICENSE`, `NOTICE`, and dependency notices when
redistributing artifacts.

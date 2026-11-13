# Cloudflare application module

The immutable `mechane-cloudflare-vVERSION.zip` contains this module, the compiled application, Console assets,
controlled database commands, and `installation.json`. Extract the qualified archive before using its directory as a
module source. Keep the complete candidate directory with its pinned `qualification.json`, artifact inventory, inputs,
and check evidence available to the provider. The source directory alone is not an installation artifact.

This module owns one public Worker, Mech, Sandbox and Machine Durable Objects, filesystem checkpoint bucket, and
container application. The Worker serves the API and Console and calls the authenticated environment API at the same
origin. Postgres retains identities, policy, credentials, grants, and accounting. Pi and the Mech Durable Object own
execution.

| Component                                                                             | Owner                        |
| ------------------------------------------------------------------------------------- | ---------------------------- |
| Worker identity, observability, domains, control-delivery schedule, checkpoint bucket | Official Cloudflare provider |
| Worker modules, ASSETS, bindings, Durable Object exports, active version              | Mechane provider             |
| Verified guest image and DO-scheduled compute application                             | Mechane provider             |
| Postgres, installation settings, secret references, migration commands                | Installation owner           |

Required inputs are `account_id`, `domain`, `qualification`, and `secrets`. The permanent `name` defaults to
`mechane-sandbox`; preserve an existing installation's Worker identity, ledgers and bucket. Optional `settings`,
`storage`, and `sandboxes` inputs configure application policy, resource names, capacity, and environment tools.
[Variable declarations](variables.tf) contain the exact types.

`qualification` supplies the local receipt path and independently pinned SHA-256. The provider checks its source,
artifact inventory, installation digest, complete input categories, and successful check evidence before API requests.
Worker modules and every Console asset are checked against the installation inventory. Preview metadata is rejected.

`settings` contains non-secret `MECHANE_*` settings. `secrets.bindings` maps application binding names to Secrets Store
secret names in `secrets.store_id`. It includes `MECHANE_SANDBOX_SERVICE_KEY`, shared by core and environment handlers.
Supply runtime Postgres, model, OAuth, encryption, and producer credentials through those references. Migration
credentials remain outside Worker bindings. The module owns the public, sandbox, and callback origins.

From `workspaces/core`, `mise run infrastructure:check` compiles the provider and validates a non-deployable module
preview using real provider schemas. It requires no cloud account.

For upgrades, review and apply the qualified bytes, then confirm the next plan has no changes. The provider preserves
all live Durable Object classes and cumulative wire and migration history. SandboxObject owns the durable workspace
ledger; MachineObject owns physical compute. The application uses Cloudflare's `durable_object` scheduling policy: the
Worker selects the qualified image and instance type at startup. No scheduler image rollout is required.
`sandboxes.max_instances` is enforced by the installation-wide Postgres admission ledger as well as each workspace's own
quota. A held reservation is released only after provider absence is confirmed.

Native snapshots are disposable acceleration for an exact committed workspace, image and tool configuration. The
portable checkpoint remains the authority and the fallback for expired or incompatible snapshots. The local celld path
uses the same compute owner with portable checkpoints; native snapshot behavior requires hosted qualification. An image
change requires the owning checkpoint and retirement procedure. For the initial compute-namespace cutover, drain and
positively retire the former scheduler-managed machines before activating the new owner. Retire only that compute
application; preserve SandboxObject, MechObject, Postgres and the workspace bucket.

Worker and bucket deletion guards remain. Removing release or image state retains remote version and image bytes. Verify
the live Console and a cold sandbox after an authorized deployment; API convergence alone does not establish asset
serving, notification execution, or command recovery.

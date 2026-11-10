# Deploy the Cloudflare application

Cloudflare hosts one Mechane application Worker, Console assets, Mech and Sandbox Durable Objects, container guests, and
the R2 checkpoint bucket. Standard Postgres holds shared control data. Pi and each Mech actor own durable execution.
Follow [self-hosting](self-hosting.md) for the complete installation procedure.

## Account and resources

Choose an account with Workers, Containers, R2, and the required Secrets Store access. Use a dedicated deployment
credential scoped to that account and the zone containing the installation domain. Preserve existing Worker, namespace,
container application, and bucket identities during upgrades.

Consume the extracted, qualified release module and complete candidate directory. Supply its independently pinned
`qualification.path` and `qualification.sha256`. The [module](../infrastructure/modules/cloudflare/README.md) owns
public routing, resource bindings, and the control-change delivery schedule. Its
[variables](../infrastructure/modules/cloudflare/variables.tf) define settings, secret references, capacity, and
environment tools.

The Mechane provider verifies qualification, modules, Console assets, and the guest image before activating the version.
Keep one deployment writer and review plans for unintended replacement. Operators deploy compiled bytes without building
application source.

## Origins and secrets

Use the public HTTPS origin for the API, Console, and GitHub callback `/auth/github/callback`. The Worker handles
application authentication and serves Console files through `ASSETS`. Its authenticated environment routes share that
origin in the canonical installation.

Supply `MECHANE_DATABASE_URL` through a secret reference for the restricted runtime role. Keep
`MECHANE_MIGRATION_DATABASE_URL` in controlled database commands only. OAuth, model, encryption, notification-producer,
and sandbox-service credentials also belong in deployment secret references. Keep values out of HCL, manifests, logs,
and browser assets.

## Environments

Configure required tools and allowed egress hosts through the installation module. Keep TLS verification enabled. An
image or network-policy change follows the checkpoint and retirement lifecycle before guest replacement.

The R2 bucket holds committed workspace generations. Keep runtime files separate from release artifacts and
infrastructure state. Preserve the previous committed generation and recoverable live files after a failed checkpoint.

## Verify

Require an empty plan after the reviewed apply. Verify readiness, sign-in, actual Console assets, notification
execution, a cold guest command, and restored files. Record active resource and artifact identities with the resulting
receipts. Local celld results do not establish hosted container or egress behavior.

The [sandbox guide](../packages/worker/sandbox/README.md) owns machine and file semantics. The
[operations guide](operations.md) covers artifact qualification, migration, passive stop receipts, and recovery.

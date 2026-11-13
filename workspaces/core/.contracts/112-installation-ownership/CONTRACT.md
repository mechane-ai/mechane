---
name: installation-ownership
message: Deploy immutable artifacts with one owner for each service, secret, and persistent resource.
paths: ["infrastructure/**", "packages/shared/deployment/**", "packages/node/distribution/**", "packages/node/guest/image/**", "packages/worker/server/**", "packages/worker/runtime/**", "packages/worker/control-store/**", "packages/node/stack/**", "packages/worker/sandbox/src/service/**", "packages/worker/sandbox/src/capacity/runtime-transport.ts", "docs/self-hosting.md", "docs/operations.md"]
---

## Rules

Build the Worker, Console assets, CLI, and controlled database commands from one declared source revision. Build the
guest from that source, or reuse an explicitly selected previously qualified guest archive only when the current generated
guest bundles, image recipe, installer, wrapper, licenses, modes, and platform match its recorded inputs.
Publish immutable artifacts with checksums and an explicit installation manifest. Operators consume those bytes;
deployment cannot rebuild product code or execute a checkout through an infrastructure provisioner.
Declare compatible provider version ranges in reusable modules. Pin exact reviewed provider releases in installation
roots and examples. An application-only change does not require a provider release when its provider interface is unchanged.

Require build metadata, module and asset inventories, installation descriptors, and qualification evidence to agree
on version and public revision. Include original licenses, attribution, and dependency notices in the verified inventory.
Derive notices from actual build inputs; missing notices require reviewed, exact-version supplements.
Set guest bundle, executable, and notice modes in the image recipe so the declared unprivileged user can read or
execute them even when the build uses a private umask.

Build a candidate once, qualify its exact bytes and declared inputs, then promote those same bytes. Qualification
records identify their source, artifacts, configuration, guarantees, and retained evidence. A check-log hash alone is
not qualification. Verify every referenced digest before deployment. Do not treat a development preview as a release.
Bind guest inputs and image digests into the candidate receipt. Reuse verifies the selected prior qualification and its
evidence, copies that exact archive, and records the prior qualification identity. A missing or mismatched proof fails
the build; it never silently selects an image or treats guest environment metadata as compatibility authority.
Use the canonical acceptance command to generate those reports from static checks and the complete retained artifact
catalog; do not duplicate that catalog in source mode or assemble qualification evidence by hand.

Emit the current API catalog and exact applied migration ledger under contract 047. Retired protocol metadata does
not require a compatibility runtime. Preserve migration integrity and actual stored data through an explicit cutover.

Infrastructure owns service identity, routing, capacity, database roles, global settings, secret references, and
notification-producer recipient allowlists. Runtime APIs own principals, workspaces, definitions, credentials, grants,
notifications, explicit messages, and files. Integration services own platform subscriptions and delivery. An
infrastructure apply cannot seed or overwrite runtime records.

Give each resource one writer. One Cloudflare application Worker owns HTTP, static assets, MechObject, SandboxObject, MachineObject,
and EgressGateway exports. Postgres owns control authority; Pi within MechObject owns execution. Preserve existing
Sandbox namespaces and file buckets when changing the application owner. MachineObject owns disposable physical compute
under Cloudflare's Durable Object scheduling policy. The installation's aggregate machine limit is atomically enforced
in the control-store admission ledger in addition to per-workspace policy. Retain reservations until provider absence
is confirmed. A compute namespace cutover requires final file checkpoints and positive retirement of its former owner;
it cannot reset workspace ledgers or command receipts. Upload every declared
module and Console asset before activating the version. Configure no independent Node host, proxy engine, or World.
Enable `global_fetch_strictly_public` in the shared Worker deployment configuration so authenticated HTTP calls to the
canonical origin traverse its public route and can re-enter the same application Worker. A compatibility date alone
does not enable this routing behavior.

When a binding targets a declared live Durable Object class without an existing namespace, provision and bind it in
the qualified version's atomic deployment. Stage and verify updates to existing bound namespaces before exclusive
activation. Retain accepted version and observed deployment identities in provider state if later verification fails.
After an accepted upload, reconcile a temporarily invisible version with bounded reads, never another upload. A 404
with Cloudflare error 10071 does not establish that a recorded version was deleted; retain its identity on refresh.

For staged upgrades to existing bound namespaces, explicitly request immediate Durable Object code adoption on the
deployment operation. Keep this deployment-owned policy separate from immutable version configuration. Its write-only
setting applies to every exported class. The atomic new-namespace creation path retains the platform's documented
adoption behavior; report that scope when verifying active actors.

Validate configured service origins as bare HTTPS origins before reading transport credentials. Reject user information,
paths, queries, and fragments. Local development may explicitly use a loopback HTTP origin with a port; guest-facing
local HTTPS uses a generated trusted root. Never disable TLS verification or bake a stack's certificate into an image.

Run the same Worker artifact locally and in production. The local supervisor starts separate celld application and
environment hosts so an application edit cannot destroy the guest. Source mode uses an explicit compiler graph watch;
artifact mode does not rebuild. Application reload preserves the environment and guest. Environment and guest edits
require explicit source apply with admission fenced. Drain fresh files before replacing a machine that admitted writers.
Distinguish source apply
from same-byte recovery restart; never silently apply an old bundle as new source. Status identifies compiled and applied
builds. Readiness requires usable control storage and execution bindings, not only a listening port. Local Postgres uses
verified TLS and the restricted runtime role. PlanetScale is a hosted default, not a local or self-hosting requirement.

Protect persistent resources from accidental replacement. An execution-owner change requires fenced admission,
reconciled effects, positive retirement of the previous owner, and preserved files and credentials. Activate one owner.
Run only the migration or import that the actual stored data requires; completed cutover procedures are not recurring
release prerequisites. Migration and import do not grant authority or clear saved maintenance holds.

Before replacing a guest image, require a fresh committed file checkpoint, actual provider retirement, and capacity
release. An accepted Stop, elapsed grace period, or successful infrastructure rollout is not a checkpoint receipt.
Keep required capacity callbacks serving until retirement completes. An uncertain stop permits passive observation;
do not blindly issue another stop or discard live files. Verify restored files after rollout.

Resolve secrets through the deployment secret store and settings boundary. Bind only runtime database credentials
to the Worker; migration credentials belong only to controlled operator commands. Manifests, public assets, logs, and
provider state contain references and fingerprints, never secret values. Keep operational evidence outside source.
API diagnostics may expose the method, path, status, numeric error codes, and validated request identifiers; never
emit request headers, query strings, bodies, or arbitrary response messages.
Sandbox maintenance failures identify their fetch, HTTP, body-read, or decode phase. Capture numeric response status
before response cleanup, validate any Cloudflare Ray identifier, and preserve the original failure if reporting fails.

Reconcile uncertain infrastructure writes through remote reads before repeating them. Bound rollout waits and report
incomplete rollout as failure. An empty plan proves convergence, not notification intake or agent behavior.

## Checks

Run builds, artifact verification, and infrastructure checks without cloud credentials. Verify the Worker module,
Console inventory, notices, source revision, current API catalog, migration checksums, and qualification inputs.
Mutate a referenced asset or evidence file and require verification to refuse it. Verify startup from the built guest
archive as its declared user.

Inspect namespace and resource plans for replacement. Reject unsupported bindings, secret-bearing descriptors,
decorated origins, inline migration credentials, and an unqualified candidate. Native provider version activation
must follow complete module and asset upload. Keep one provider writer and qualify repeat-deploy convergence.
Reject a staged version that binds an unprovisioned class, and verify atomic activation of the qualified version
preserves existing namespaces. Exercise a failed follow-up read and a lost upload response without losing accepted
resource identities or repeating the upload.
Exercise delayed version visibility, its deadline, and a subsequent refresh that preserves the accepted identity.
Inspect a staged upgrade's deployment request for immediate code adoption. After hosted activation, exercise current
operations on an actor that was active before deployment; Worker readiness alone cannot establish actor code adoption.

Reuse the retained scenario catalog for local source checks and exact-artifact acceptance. Exercise the shared public
operation path at each declared target; record target capabilities instead of treating a local provider as hosted proof.
After authorized cloud activation, verify serving artifact identity, health, readiness, and actual Console assets.
Run additional hosted or integration qualification when the changed boundary requires it. Notification delivery,
pending-input recovery, explicit tool communication, and genuine approval decisions retain their owning scenarios.
Local celld success does not establish workerd container or cloud parity.
Does every application and environment composition inherit the public-fetch flag from the shared deployment owner?
For changed routing or maintenance composition, exercise a hosted public sandbox request through the canonical origin
and observe its internal handler and result. Standalone workerd cannot qualify Cloudflare's own-zone routing behavior.
Record artifact identities, live resource readbacks, remaining uncertainties, and end-to-end receipts in the delivery
issue or pull request. For an image change, retain checkpoint, stopped-provider, capacity-release, and restored-file
receipts before calling the rollout complete.
Reload an application-only edit and explicitly apply an environment-handler edit. Verify current served behavior,
file and command receipts, and the declared guest lifetime. Successful compilation alone does not establish applied code.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

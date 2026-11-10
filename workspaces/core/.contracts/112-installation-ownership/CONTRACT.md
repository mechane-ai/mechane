---
name: installation-ownership
message: Deploy immutable artifacts with one owner for each service, secret, and persistent resource.
paths: ["infrastructure/**", "packages/node/distribution/**", "packages/worker/server/**", "packages/worker/runtime/**", "packages/worker/control-store/**", "packages/node/stack/**", "packages/worker/sandbox/src/service/**", "packages/worker/sandbox/src/capacity/runtime-transport.ts", "docs/self-hosting.md", "docs/operations.md"]
---

## Rules

Build the Worker, Console assets, guest image, CLI, and controlled database commands from one declared source revision.
Publish immutable artifacts with checksums and an explicit installation manifest. Operators consume those bytes;
deployment cannot rebuild product code or execute a checkout through an infrastructure provisioner.

Require build metadata, module and asset inventories, installation descriptors, and qualification evidence to agree
on version and public revision. Include original licenses, attribution, and dependency notices in the verified inventory.
Derive notices from actual build inputs; missing notices require reviewed, exact-version supplements.

Build a candidate once, qualify its exact bytes and declared inputs, then promote those same bytes. Qualification
records identify their source, artifacts, configuration, guarantees, and retained evidence. A check-log hash alone is
not qualification. Verify every referenced digest before deployment. Do not treat a development preview as a release.

Emit cumulative shipped wire history and the exact migration ledger under contract 047. Preserve published entries
when an active endpoint is retired. Keep the provider's format-preservation guard enabled.

Infrastructure owns service identity, routing, capacity, database roles, global settings, secret references, and
notification-producer recipient allowlists. Runtime APIs own principals, workspaces, definitions, credentials, grants,
notifications, explicit messages, and files. Integration services own platform subscriptions and delivery. An
infrastructure apply cannot seed or overwrite runtime records.

Give each resource one writer. One Cloudflare application Worker owns HTTP, static assets, MechObject, SandboxObject,
and EgressGateway exports. Postgres owns control authority; Pi within MechObject owns execution. Preserve existing
Sandbox namespaces, container identity, and file buckets when changing the application owner. Upload every declared
module and Console asset before activating the version. Configure no independent Node host, proxy engine, or World.

Validate configured service origins as bare HTTPS origins before reading transport credentials. Reject user information,
paths, queries, and fragments. Local development may explicitly use a loopback HTTP origin with a port; guest-facing
local HTTPS uses a generated trusted root. Never disable TLS verification or bake a stack's certificate into an image.

Run the same Worker artifact locally and in production. The local supervisor starts separate celld application and
environment hosts so an application edit cannot destroy the guest. Source mode uses an explicit compiler graph watch;
artifact mode does not rebuild. Readiness requires usable control storage and execution bindings, not only a listening
port. Local Postgres uses verified TLS and the restricted runtime role. PlanetScale is a hosted default, not a local
or self-hosting requirement.

Protect persistent resources from accidental replacement. Before cutover, save current policy, fence admission,
reconcile in-flight effects, positively retire every old execution owner, and preserve files and credentials. Apply
reviewed migrations and historical imports only after their preflight gates pass. Import does not clear maintenance
holds. Activate one native owner and restore exact saved policies deliberately; never run both engines.

Before replacing a guest image, require a fresh committed file checkpoint, actual provider retirement, and capacity
release. An accepted Stop, elapsed grace period, or successful infrastructure rollout is not a checkpoint receipt.
Keep required capacity callbacks serving until retirement completes. An uncertain stop permits passive observation;
do not blindly issue another stop or discard live files. Verify restored files after rollout.

Resolve secrets through the deployment secret store and settings boundary. Bind only runtime database credentials
to the Worker; migration credentials belong only to controlled operator commands. Manifests, public assets, logs, and
provider state contain references and fingerprints, never secret values. Keep operational evidence outside source.

Reconcile uncertain infrastructure writes through remote reads before repeating them. Bound rollout waits and report
incomplete rollout as failure. An empty plan proves convergence, not notification intake or agent behavior.

## Checks

Run builds, artifact verification, and infrastructure checks without cloud credentials. Verify the Worker module,
Console inventory, notices, source revision, historical wire entries, migration checksums, and qualification inputs.
Mutate a referenced asset or evidence file and require verification to refuse it.

Inspect namespace and resource plans for replacement. Reject unsupported bindings, secret-bearing descriptors,
decorated origins, inline migration credentials, and an unqualified candidate. Native provider version activation
must follow complete module and asset upload. Keep one provider writer and qualify repeat-deploy convergence.

For authorized cloud qualification, verify health, readiness, actual Console assets, notification intake, an application
restart with pending input, native execution, and explicit tool communication. Qualify a real approval decision after
restart through its integration owner. Local celld success does not establish workerd container or cloud parity.
Record artifact identities, live resource readbacks, remaining uncertainties, and end-to-end receipts in the delivery
issue or pull request. For an image change, retain checkpoint, stopped-provider, capacity-release, and restored-file
receipts before calling the rollout complete.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

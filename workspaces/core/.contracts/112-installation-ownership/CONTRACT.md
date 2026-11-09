---
name: installation-ownership
message: Deploy immutable artifacts with one owner for each service, secret, and persistent resource.
paths: ["infrastructure/**", "packages/node/distribution/**", "packages/node/server/**", "packages/worker/sandbox-service/**", "packages/worker/sandbox/src/capacity/runtime-transport.ts", "docs/self-hosting.md", "docs/operations.md"]
---

## Rules

Build the Node service, Console assets, guest image, and sandbox service from one declared source revision. Publish
immutable artifacts with checksums and an explicit runtime manifest. Operators consume those artifacts rather than
rebuilding application code from a checkout or executing source through an OpenTofu provisioner.

Require the compiled Node metadata, archive inventory, and release receipt to agree on version and public revision.
Include the original license, attribution, and generated Node and browser dependency notices in the verified inventory.
Derive dependency notices from build inputs; missing package notices require reviewed, exact-version supplements.

Keep infrastructure configuration responsible for service identity, domain routing, capacity, database roles, global
settings, secret references, and notification-producer recipient allowlists. Runtime APIs own principals, workspaces,
mechs, credentials, grants, notifications, messages, and files. Integration services own platform subscriptions and
delivery. An infrastructure apply cannot seed or overwrite runtime records.

Give each resource one writer. The installation owner configures the managed Node host and its database. Cloudflare
owns the narrow sandbox service, file bucket, and public ingress. The ingress forwards HTTP and streams unchanged to
the configured Node service; it does not retain the old agent engine or independently decide product authorization.

Restrict hosted runtime transport to bare HTTPS `service.modal.run` or `service.region.modal.direct` origins.
Reject user information, explicit ports, paths, queries, fragments, and hostnames outside those shapes before reading
transport credentials. Keep installation validation and live transport acceptance consistent. The local stack may
explicitly use an HTTP loopback origin with a port.

Use the same built Node application and supported Workflow World locally and in production. Start and stop the
Workflow worker with the service. Readiness means the application can use its required database and execution owner,
not merely that a TCP port accepts connections. Admit overlapping service instances only with shared durable claims.

Protect persistent resources from accidental replacement. The owner-authorized native-runtime cutover initializes
fresh agent state once; later releases follow contracts 047 and 061. That cutover does not authorize deletion of
unrelated services, credentials, or sandbox files.

Before an image rollout can replace guests, qualify their fresh file checkpoints and retirement, actual provider
stops, and capacity release. Provider rollout completion and grace periods are not checkpoint receipts. Keep the
serving Node available through guest retirement callbacks. For the strict schema 1 upgrade, checkpoint while policy
still permits capacity, fence and recheck idle work, retire guests, then stop all old Node instances before migration.
Resolve admission races on the old release. Restore exact saved policies before allocating qualification guests.

Resolve secrets through the deployment's secret store and runtime settings boundary. Release manifests, provider
metadata, logs, and public assets contain no secret values. Use separate runtime and migration database credentials.
Keep operational deployment evidence outside product source.

Reconcile uncertain infrastructure operations using remote reads before repeating them. Bound rollout waits and
report an incomplete rollout as a failure. An empty follow-up plan verifies declarative convergence; it does not prove
that notification intake, model execution, or explicit communication works.

## Checks

Inspect release manifests and archives for revision, checksums, required assets, and secret-free metadata. Run the
repository's build and infrastructure checks with no cloud credentials.
The distribution verifier checks every Node file and required notice entry; inspect generated dependency notices when
the bundled graph changes.

Exercise supported hosted origins through installation validation and runtime transport. Verify that suffix lookalikes
and decorated origins fail before transport credentials are read, while the explicit local loopback still works.

For an authorized hosted qualification, verify health and readiness, a repeat deployment, a process restart with a
pending inbox notification, and explicit tool communication. Qualify approval decisions and their explicit replies
through the owning application integration. Check that a repeated infrastructure plan changes nothing
and that persistent resources have no replacement action. Record live evidence in the delivery issue or pull request.
For guest image changes, retain the fresh checkpoint or maintenance receipt, stopped-provider readback, and released
capacity before apply. Afterward verify restored files and browser evidence under the restored workspace policies.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

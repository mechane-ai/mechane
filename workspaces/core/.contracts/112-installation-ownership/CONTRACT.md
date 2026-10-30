---
name: installation-ownership
message: Keep release and cloud resources declarative while preserving dynamic runtime data and one owner for each deployed resource.
paths: ["infrastructure/**", "packages/node/distribution/**", "docs/self-hosting.md"]
---

## Rules

Install and upgrade from immutable, checksum-bound public release artifacts. Ordinary operators must not compile source,
run Docker builds, or execute a deployment shell script through an OpenTofu provisioner.

Keep installation version, resource identities, domains, capacity, and global settings in infrastructure configuration.
Keep agents, missions, workspaces, credentials, grants, Slack bindings, watches, conversations, and files in Mechane's
runtime APIs and stores. An infrastructure apply must not seed or overwrite those records.

Give each cloud field one writer. Cloudflare's provider owns Worker identity, domains, and R2; Mechane's provider owns
Worker release activation, image distribution, and container application rollout. Do not run the retired source deploy
pipeline against resources owned by OpenTofu.

Import existing resource identities before adopting an installation. Preserve Durable Object namespaces and the workspace
bucket. Protect persistent resources from accidental replacement or deletion. Runtime imports use create-only writes
and never become an ongoing fallback to deployment configuration.

Use real remote reads for drift detection. Reconcile interrupted operations before creating another version or rollout,
and bound every wait. A failed or incomplete rollout is an apply failure. Deleting a release resource must not delete its
Worker or databases; removing an image resource must not erase an image still used by a release.

Pass secret references through the module and resolve values at the runtime settings boundary. Reject secret values in
provider metadata, and omit credentials and arbitrary server bodies from diagnostics.

## Checks

From `workspaces/core`, run `mise run infrastructure:check` to compile the provider, check formatting, and validate the
packaged module against the real provider schemas without cloud credentials. This establishes schema compatibility,
not cloud lifecycle behavior.

For a changed lifecycle, use explicitly authorized disposable cloud resources to verify an empty second plan, in-place
upgrade with stored data intact, out-of-band drift detection, and interrupted-operation recovery. Record resource IDs
and clean up only the fixture's resources. Review an existing-installation import plan for persistent replacements.

Review the module's inputs and provider resource list: none may manage an individual agent or workspace integration.
Inspect release archives for public provenance and notices, and verify their manifest digests before publication.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->

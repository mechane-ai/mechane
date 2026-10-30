# Cloudflare installation module

The published `mechane-cloudflare-vVERSION.zip` contains this module, its Worker bundle, and `installation.json`. Use
the archive as a module source; this source directory alone is not a release. The
[self-hosting guide](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/docs/self-hosting.md) covers setup
and runtime administration. The source example is at
[`infrastructure/examples/cloudflare/main.tf`](https://github.com/mechane-ai/mechane/blob/main/workspaces/core/infrastructure/examples/cloudflare/main.tf).

## Ownership

| Component                                                       | Owner                                              |
| --------------------------------------------------------------- | -------------------------------------------------- |
| Worker identity, observability, domains, R2 workspace bucket    | Official Cloudflare provider                       |
| Worker bundle, bindings, Durable Object exports, active version | Mechane provider's worker release resource         |
| Verified image copy and container application rollout           | Mechane provider's image and application resources |
| Agents, workspaces, integrations, credentials, and files        | Runtime API and Durable Objects                    |

The provider calls Cloudflare's APIs directly. It runs no local provisioner or Wrangler subprocess. The native Worker
release resource works around an official provider defect: releases with `deploy` support cannot currently decode an
`exports` map. Atomic upload with deployment is needed to provision a new self-bound Durable Object class. The public
module keeps this lifecycle detail out of consumer configuration.

## Inputs

Required inputs are `account_id`, `domain`, `authentication`, `secrets`, and `model`. `name` defaults to `mechane`.
Optional `storage`, `sandboxes`, and `budgets` objects set resource names, capacity, initial budgets, and global
ceilings. [Variable declarations](variables.tf) contain exact types and defaults. No input accepts an individual agent
or workspace integration. No input accepts credential values.

`authentication.administrators` contains stable numeric GitHub subjects. A null `allowed_identities` permits public
GitHub sign-in; an empty set denies everyone. Choose the intended policy explicitly. Secret names refer to existing
entries in one Cloudflare Secrets Store. The credential keyring must be dedicated to this installation.

Outputs provide `origin`, the installed `version`, and cloud resource IDs. After applying, use the origin with the
ordinary Mechane CLI. A local module validation preview is marked as such and cannot be applied.

## Import

Use import blocks in the consumer repository and inspect the plan before applying. Replace `module.mechane` if your
module call uses another name.

| Resource address                                                                | Import ID                             |
| ------------------------------------------------------------------------------- | ------------------------------------- |
| `module.mechane.cloudflare_worker.service`                                      | `ACCOUNT_ID/WORKER_ID`                |
| `module.mechane.mechane_cloudflare_worker_release.release`                      | `ACCOUNT_ID/WORKER_NAME`              |
| `module.mechane.cloudflare_r2_bucket.workspace_files`                           | `ACCOUNT_ID/BUCKET_NAME/JURISDICTION` |
| `module.mechane.mechane_cloudflare_container_application.sandboxes`             | `ACCOUNT_ID/APPLICATION_ID`           |
| `module.mechane.cloudflare_workers_custom_domain.service["agents.example.com"]` | `ACCOUNT_ID/DOMAIN_ID`                |

The release resource returns each class's namespace ID from the uploaded Worker bindings. An imported installation keeps
its existing namespace identities. For a Worker predating immutable installation manifests, supply the one-time
`adoption_baseline` with its exact live version ID, bundle checksum, release version, and reviewed wire and migration
locks. Remove this input after adoption succeeds. Missing or mismatched history stops the release before upload. The
image resource copies the new release's OCI image by digest; old image bytes remain available for existing versions.

Keep the original Worker and bucket names. Importing is a state operation, not permission to replace persistent
resources. The module's Worker and bucket deletion guards make replacement plans fail. To intentionally retire an
installation, first remove its resource ownership from OpenTofu and then delete the chosen cloud resources through an
explicit operator procedure. Removing a release or image resource alone retains its remote version or image bytes.

## Checks and upgrades

From `workspaces/core`, `mise run infrastructure:check` compiles the native provider and validates a non-deployable
module preview using real provider schemas. It requires no cloud account. Cloud lifecycle qualification uses separately
owned, disposable resources and is not part of contributor checks.

Change the immutable module archive to upgrade. Preserve the consumer's provider lockfile, review the plan, apply, and
confirm the next plan has no changes. The release resource reads each active Worker version and verifies its immutable
installation manifest before upload. It refuses version downgrades and removal of any shipped wire or migration entry.
The container resource waits for completed rollout. Retry an interrupted update after refreshing state so it can resume
existing work.

If interruption leaves an initial creation tainted, first verify the remote resource and its ID. Remove only that state
binding and import the existing resource before re-planning. Keep deletion protection enabled throughout recovery.

Cloudflare cannot activate an older version without declarative exports after this module establishes them. To run older
compatible code, publish it as a new release retaining the current export declarations and append-only data formats.

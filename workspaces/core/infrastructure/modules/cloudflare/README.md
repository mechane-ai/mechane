# Cloudflare compute module

The published `mechane-cloudflare-vVERSION.zip` contains this module, the compute Worker, and `installation.json`. Use
the archive as a module source. The source directory alone is not a release.

This module owns the public ingress gateway, sandbox Durable Objects, filesystem checkpoint bucket, and container
application. The gateway forwards application requests to the private Node service. The Node service and Postgres own
agents, sessions, credentials, approvals, and conversation streams.

| Component                                                     | Owner                        |
| ------------------------------------------------------------- | ---------------------------- |
| Worker identity, observability, domains, checkpoint bucket    | Official Cloudflare provider |
| Worker bundle, bindings, SandboxObject export, active version | Mechane provider             |
| Verified guest image and container rollout                    | Mechane provider             |
| Node deployment, database, runtime secrets                    | Installation owner           |

Required inputs are `account_id`, `domain`, `runtime`, and `secrets`. The `name` defaults to `mechane-sandbox`. Optional
`storage` and `sandboxes` inputs set resource names, compute capacity, and allowed egress hosts.
[Variable declarations](variables.tf) contain the exact types. Inputs accept secret references, never credential values.

The runtime origin is an exact private Modal service origin. The transport secret authenticates proxy requests to that
service. The separate sandbox key authenticates host requests to the compute API. Model, OAuth, and vault credentials
belong to the Node deployment and are absent from this module.

A new installation needs its own Worker identity. Upgrades retain its namespace and checkpoint identities.

From `workspaces/core`, `mise run infrastructure:check` compiles the provider and validates a non-deployable module
preview using real provider schemas. It requires no cloud account. Published module archives reject preview metadata.

To upgrade, change the immutable module archive, review the plan, apply, and confirm the next plan has no changes. The
provider checks live release provenance before uploading and waits for the container rollout. Verify an actual cold
sandbox after applying; a completed rollout alone does not prove command execution.

The Worker and bucket have deletion guards. Retiring a compute service is a separate operator action. Removing a release
or image resource retains remote version and image bytes.

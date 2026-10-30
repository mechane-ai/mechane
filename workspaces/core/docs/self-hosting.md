# Run your own Mechane

A cloud installation consists of a Worker, Durable Objects, a private R2 workspace bucket, and Cloudflare Containers.
OpenTofu manages those resources from a versioned release archive. Follow [Cloudflare setup](cloudflare-setup.md) for
account preparation, OAuth, secrets, the provider download, and a first apply. Operators deploy without a source
checkout, Node installation, or Docker daemon. Local installations use the same runtime on celld; see the
[local guide](../packages/node/stack/README.md).

## Installation and runtime data

| OpenTofu owns                                           | Mechane's API, CLI, and SDK own                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| Release version, account, Worker identity, domains      | Workspaces, membership, agents, missions                         |
| Workspace storage and container capacity                | Files, conversations, memories, machine leases                   |
| Identity admission and installation administrators      | Integration credentials, connections, grants                     |
| Model service, offers, initial budgets, global ceilings | Slack installations, channel bindings, watches, workspace policy |

Applying infrastructure never seeds, resets, or reconciles agents. The application reads its own data after an upgrade.
A factory can keep an example agent setup script, but running that script is an explicit runtime operation, separate
from `tofu apply`.

## Infrastructure

Keep the [Cloudflare declaration](../infrastructure/examples/cloudflare/main.tf) in your infrastructure repository and
retain its Worker name across upgrades. The release archive contains the Worker, installation manifest, compatibility
metadata, and notices. The provider copies the verified sandbox image into your account registry without a local build.

The module receives only secret references. Supply the deployment token through `CLOUDFLARE_API_TOKEN`; secret values
stay outside HCL and state. Treat state as private infrastructure inventory. The [operations guide](operations.md)
covers remote state, locking, secret rotation, recovery, and operator access.

The module disables workers.dev and preview URLs. It keeps structured Worker logs but disables automatic invocation logs
and traces, which can record OAuth query strings. Workspace storage and Worker identity have deletion protection.
Deleting an installation's actual data is a separate deliberate operator action.

## Use the service

Download the CLI from the installation's `/install.sh` or the public release assets, then select your origin:

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane auth login
mechane mech create --name scout
mechane inbox send MECH_ID 'hello, scout'
```

Each admitted identity receives a personal workspace. Installation administrators can create shared workspaces and
manage membership through the [access commands](operations.md#access). Installation admission and workspace membership
are separate grants. Workspace policy remains bounded by the installation's machine and spending ceilings.

Workspace owners manage integration credentials through write-only credential operations, then use their references when
configuring connections or Slack installations. Supply credential values from a file or standard input, never a command
argument. Listing credentials returns metadata only. The Worker encrypts values with workspace-bound associated data;
agents and sandbox machines never receive the stored credentials.

Owner-managed Slack bindings, grants, and watches remain runtime records across infrastructure updates. For sandbox
admission and startup checks, see [sandbox operations](operations.md#sandboxes).

## Upgrade

Follow the [upgrade procedure](operations.md#changes) to update immutable release and provider versions, review the
plan, and apply with one deployment writer. Preserve the Worker identity and workspace bucket. The container provider
waits for rollout completion and resumes an existing rollout after an interrupted apply.

CLI downloads use immutable versioned paths, so an update can finish from a cached manifest after a deployment.
`/cli/latest.json` selects the running Worker's release.

The provider verifies the active release's immutable manifest before uploading its successor. It rejects removed wire or
migration entries and version downgrades. Publish compatible recovery code as a newer release when needed. Database
changes run in the owning Durable Objects; application data is never part of the OpenTofu state.

## Adopt an existing installation

Import resources into state before applying. Preserve the Worker, container application, namespace, bucket, and domain
identities. The [module guide](../infrastructure/modules/cloudflare/README.md) lists import addresses. Inspect the
resulting plan and refuse replacements of persistent resources.

For installations that previously supplied workspace credentials, Slack metadata, or workspace lists as Worker settings,
use `mechane --workspace WORKSPACE_UUID workspace import --file PRIVATE_JSON`. The file contains required `credentials`
and `slack_installations` collections and an optional `policy`. Use empty collections when there is nothing to import.
Omit absent optional Slack references rather than supplying null. Pause incoming work during this transition, write
credentials and metadata through the new APIs, verify their metadata and policy, then resume. Import uses create-only
writes so a retry cannot silently overwrite later runtime changes. Remove the obsolete deployment maps once the import
succeeds. Subsequent infrastructure applies have no authority over those records.

An existing deployment can preserve default-deny sandbox admission with `sandboxes.workspace_default_enabled = false`,
then import `policy.sandboxes = true` only for its previously admitted workspaces. This default affects workspaces
without a stored policy; `sandboxes.enabled` remains the installation-wide switch.

The former source-checkout deploy program is retired. Once OpenTofu owns an installation, do not use Wrangler or another
pipeline to deploy the same Worker or container application.

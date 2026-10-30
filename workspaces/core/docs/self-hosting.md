# Run your own Mechane

A cloud installation consists of a Worker, Durable Objects, a private R2 workspace bucket, and Cloudflare Containers.
OpenTofu manages those resources from a versioned release archive. Operators need OpenTofu and Cloudflare credentials;
they do not clone Mechane, install Node, or run Docker to deploy it. Local installations use the same runtime on celld;
see the [local guide](../packages/node/stack/README.md).

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

## Prepare the account

Enable Workers, Containers, R2, and Secrets Store in your Cloudflare account. Use a domain in a zone you control. Create
a GitHub OAuth application with that origin as its homepage and `https://YOUR_DOMAIN/auth/github/callback` as its
callback. Record its client ID and your GitHub numeric user ID; login names do not grant administrator access.

Create three entries in an account Secrets Store:

| Entry                          | Value                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| `mechane-github-client-secret` | GitHub OAuth client secret                                      |
| `mechane-model-api-key`        | Model provider credential                                       |
| `mechane-credential-keyring`   | A dedicated random encryption keyring for workspace credentials |

The keyring format is `{"current":"v1","keys":{"v1":"64-lowercase-hex-characters"}}`. Generate the 32-byte key with a
cryptographic random source and write the resulting value directly to Secrets Store. Keep this keyring separate from
other applications. Rotation adds a new key and selects it as `current`; retain earlier keys while ciphertexts still use
them. Locally, the launcher creates and retains this keyring in the installation's private state directory.

The module receives only the store ID and entry names. Secret values do not enter OpenTofu configuration or state.
Supply the deployment token using `CLOUDFLARE_API_TOKEN`, outside HCL. It needs permission to manage Workers,
Containers, R2, the chosen zone's Worker domains, and Account Secrets Store Edit. Cloudflare requires Secrets Store Edit
even to bind an existing secret; Read permission is insufficient. See its
[access controls](https://developers.cloudflare.com/secrets-store/access-control/). Treat state as private
infrastructure inventory even though the module passes no secret values to it.

## Declare the service

Copy the [Cloudflare example](../infrastructure/examples/cloudflare/main.tf) into your infrastructure repository. Set
the account, domain, OAuth identity, secret references, and real model offers. Choose a permanent Worker name and retain
it across upgrades. The release archive contains the Worker, installation manifest, compatibility metadata, and notices.
The provider copies the verified sandbox image into your account registry without a local image build.

```sh
tofu init
tofu plan -out=installation.tfplan
tofu apply installation.tfplan
tofu plan -detailed-exitcode
```

The final plan should exit zero with no changes. A successful apply establishes the cloud resources and completes the
container rollout; it does not prove that third-party OAuth or model credentials are valid. Check the service's
`/health` and `/v1/readiness` endpoints and perform a normal login. Configure the OAuth app before attempting login.

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

Each admitted identity receives a personal workspace. Installation administrators can create shared workspaces:

```sh
mechane workspace create --name Company --workspace-id WORKSPACE_UUID
export MECHANE_WORKSPACE_ID=WORKSPACE_UUID
mechane workspace member set PRINCIPAL_UUID --role member
```

The person must already have signed in; `mechane auth status` shows their principal ID. Workspace membership and
installation admission are separate grants. `--workspace UUID` overrides `MECHANE_WORKSPACE_ID`; an inaccessible
selection fails instead of falling back to another workspace.

Workspace owners manage integration credentials through write-only credential operations, then use their references when
configuring connections or Slack installations. Supply credential values from a file or standard input, never a command
argument. Listing credentials returns metadata only. The Worker encrypts values with workspace-bound associated data;
agents and sandbox machines never receive the stored credentials.

Installation administrators change workspace policy without redeployment:

```sh
mechane workspace policy show WORKSPACE_UUID
mechane workspace policy set WORKSPACE_UUID --suspended false --sandboxes true --machines 4 --daily-allowance-micros 20000000
```

Live policy remains bounded by the installation's machine and spending ceilings. Suspension blocks subsequent member
requests and admission of new work; it is not an instruction to erase files. Owner-managed Slack bindings, grants, and
watches remain runtime records across infrastructure updates.

## Upgrade

Change the module source to the next immutable release archive, run `tofu init -upgrade`, and review the plan before
applying. Keep your provider lockfile in version control. A normal upgrade updates the release and image in place; it
must not replace Worker identity or the workspace bucket. The container provider waits for rollout completion and
resumes an existing rollout after an interrupted apply. Re-plan before retrying an interrupted operation.

CLI downloads use immutable versioned paths, so an update can finish from a cached manifest after a deployment.
`MECHANE_RELEASE_ORIGIN` names the stable artifact base, such as
`https://github.com/mechane-ai/mechane/releases/download`. The proxy selects the requested release beneath it;
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

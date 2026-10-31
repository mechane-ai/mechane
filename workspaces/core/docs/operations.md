# Operate Mechane

Keep one infrastructure repository and one shared state for each installation. Start with
[Cloudflare setup](cloudflare-setup.md), then use this guide for upgrades, recovery, secrets, and access. The
[installation boundary](self-hosting.md#installation-and-runtime-data) separates cloud resources from workspace data.

## State

Use OpenTofu 1.13.0 with the standard S3 backend and native locking on a private Cloudflare R2 bucket. Create the bucket
separately from the installation whose state it stores. Give each installation a distinct state key and keep this bucket
outside runtime storage cleanup.

Save the [backend example](../infrastructure/examples/cloudflare-state/backend.tf.example) as `backend.tf` beside
`main.tf`. Replace its account ID, bucket, and key. Keep the example's R2 settings, including `use_lockfile = true`.
OpenTofu creates `<state-key>.tflock` using conditional writes; R2 evaluates competing writes atomically. See
[OpenTofu's backend](https://opentofu.org/docs/language/settings/backends/s3/) and
[R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/#conditional-writes).

Create a separate [R2 account token](https://developers.cloudflare.com/r2/api/tokens/) with **Object Read & Write**
limited to the state bucket. Load its access key ID and secret access key through `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`. Keep them separate from the deployment token in `CLOUDFLARE_API_TOKEN`. Unset
`AWS_SESSION_TOKEN` when using these long-lived R2 credentials. Never put credentials in HCL, tfvars, or
`-backend-config`; backend configuration is copied into local metadata and saved plans.

Commit the backend configuration and `.terraform.lock.hcl`. Ignore `.terraform/`, `.mechane/`, `*.tfstate`,
`*.tfstate.*`, `*.tfplan`, and crash logs. Keep protected state backups outside Git. Disable object expiration for state
and locks. Avoid retention rules that prevent lock deletion.

For a new installation with no state, configure the backend before the first `tofu init`. To move existing local state:

1. Stop every writer, including automation. Before adding `backend.tf`, save the current initialized state with the
   commands below. Use new private filenames for both state snapshots.
2. Add the backend configuration and inspect the destination bucket and key. If state already exists, reconcile its
   lineage, serial, and resources with the local state before migrating. Never overwrite unseen remote state or use
   `-force-copy`.
3. Run `tofu init -migrate-state` and review its copy prompt. Pull the remote state into another private file and verify
   that resource values, IDs, and outputs are unchanged. Confirm a plan reports no changes before resuming.

```sh
umask 077
tofu state pull > before-migration.tfstate
```

After adding `backend.tf` and checking its destination:

```sh
tofu init -migrate-state
tofu state pull > after-migration.tfstate
tofu plan -lock-timeout=60s -detailed-exitcode
```

Record both snapshots' lineage and serial. Native migration to an empty R2 key can create a new lineage and reset the
serial. Discard every pre-migration saved plan and reconnect all writers to the shared state.

Other operators use `tofu init` against the committed backend. Use `tofu init -reconfigure` only to reconnect an
initialized directory to already authoritative state; it does not copy local state. Backend moves require
`-migrate-state`. Never re-migrate a stale local copy over shared state. OpenTofu documents this distinction in
[backend initialization](https://opentofu.org/docs/cli/commands/init/#backend-initialization).

## Changes

Serialize the whole plan, review, and apply sequence for an installation. A backend lock covers individual commands; it
does not reserve the interval while someone reviews a saved plan. Discard the plan after any intervening apply,
configuration change, or failed operation, then create and review a new one.

To upgrade, select the next immutable module archive and matching provider version in `main.tf`. Complete that version's
[provider setup](cloudflare-setup.md#provider) when using the filesystem mirror. Keep its `TF_CLI_CONFIG_FILE` selected,
then run:

```sh
umask 077
tofu init -upgrade
tofu plan -lock-timeout=60s -out=installation.tfplan
tofu show installation.tfplan
tofu apply -lock-timeout=60s installation.tfplan
tofu plan -lock-timeout=60s -detailed-exitcode
```

Review before `apply`. Reject unexpected replacements of the Worker, Durable Object namespaces, workspace bucket, or
container application. Commit the reviewed configuration and provider lockfile. An unchanged final plan exits zero; exit
two means changes remain. A stale-plan error requires a new plan, never disabled locking.

Finish or cancel pending sandbox maintenance before upgrading. Choose a quiet period because Worker updates can restart
Durable Objects and disconnect event streams. Keep model offers while agents still reference their IDs. Readers can
reconnect with their saved `--after` cursor.

The provider waits for container rollout, but an apply cannot prove third-party credentials work. Check `/health`,
`/v1/readiness`, ordinary login, an existing agent's history, and its saved files. Exercise a model request and a cold
sandbox restore when approving an upgrade; those checks use the installation's paid services.

## Recovery

After an interrupted apply, inspect the reported Worker version and container rollout before starting another operation.
Run a fresh plan against the same state and resource identities. The provider reconciles existing rollouts; preserve the
diagnostics if it cannot finish. Never recreate the Worker, namespace, or bucket to clear an apply error.

If a state lock remains, establish that its writer and every competing apply have stopped. Confirm the backend bucket,
key, and exact lock UUID from the error. Only then unlock from that initialized installation and re-plan:

```sh
tofu force-unlock LOCK_UUID
tofu plan -lock-timeout=60s -out=installation.tfplan
```

Age, a matching username, or a timeout does not prove the owner is dead. Never use `-lock=false` to recover.
[Force-unlock](https://opentofu.org/docs/cli/commands/force-unlock/) removes the lock, not the underlying
infrastructure. OpenTofu's [issue #4405](https://github.com/opentofu/opentofu/issues/4405) describes a successful lock
write whose ambiguous response can leave the caller's own lock behind. Native locking provides no automatic stale-lock
recovery.

State recovery restores infrastructure ownership, not application data. Keep the Worker identities, namespaces, R2
objects, and encryption keys needed by those objects. Inspect a recovered state against live resource IDs before
applying it. Never push an older backup over current remote state without reconciling the difference.

The provider rejects version downgrades and missing migration or protocol entries. Publish compatible recovery code as a
newer release. Changing the module URL cannot undo database migrations or restore deleted runtime data. The
[compatibility check](../infrastructure/provider/internal/provider/worker_release_compatibility.go) owns these rules.

## Secrets

OAuth, model, and credential-encryption secrets live in Cloudflare Secrets Store. OpenTofu holds only their references.
To rotate an OAuth or model credential, issue its replacement, update the same named secret, and verify a fresh login or
model request. Revoke the old upstream credential after verification when the provider supports overlap.

Editing a secret changes every service bound to that entry; keep installation secrets dedicated to their installation.
See
[Cloudflare's secret editing guide](https://developers.cloudflare.com/secrets-store/manage-secrets/how-to/#edit-a-secret).

Mechane [resolves secret bindings on use](../packages/worker/rpc/src/secrets/operator-secret-reader.ts). Replacing a
value under the same name needs no infrastructure apply. Changing the store or secret name changes its infrastructure
reference and requires the ordinary plan and apply process.

Rotate the encryption keyring without losing earlier key IDs:

1. Add a fresh key under a new ID and select it as `current`, preserving every existing ID and value. Store the updated
   [keyring](../packages/shared/deployment/src/credential-keyring.schemas.ts) under the same Secrets Store name.
2. Have each workspace owner resubmit every retained credential value under its existing reference. Use a private file
   containing only that value. There is no read-value or bulk re-encryption API.
3. List each workspace's credential metadata and confirm its `key_version`. Keep old keys until no stored credential or
   retained backup needs them. Keep them when any workspace remains unverified.

```sh
mechane --workspace WORKSPACE_UUID credential put REFERENCE --file /private/path/credential
mechane --workspace WORKSPACE_UUID credential list
```

Every [`credential put`](../packages/worker/edge/src/operations/credentials/put-credential.ts) encrypts again with the
current key and a fresh nonce, even when the value is unchanged. Existing records do not rotate when `current` changes.
There is no installation-wide credential inventory, and administrator access does not grant workspace-owner access.
Retain the keyring securely with recovery material; losing a required key makes its ciphertext unreadable.

## Access

Keep explicit GitHub identities in the installation's admission list. Use numeric GitHub user IDs, not usernames or
organization names. Add an installation administrator only when that person needs to create shared workspaces or change
workspace policy. Apply these configuration changes through the same reviewed plan process.

An admitted person signs in and sends their principal UUID from `auth status` to a workspace owner:

```sh
export MECHANE_ORIGIN=https://agents.example.com
mechane auth login
mechane auth status
```

An installation administrator creates the shared workspace. The command prints its UUID; reuse that ID with
`--workspace-id` if creation needs a retry. The creator becomes its owner:

```sh
mechane workspace create --name Company
mechane --workspace WORKSPACE_UUID workspace member set PRINCIPAL_UUID --role member
mechane --workspace WORKSPACE_UUID workspace members
```

Owners can grant the `owner` role or remove access with `workspace member remove PRINCIPAL_UUID`. Keep at least one
owner. Membership grants access only to that workspace; it does not grant installation admission or administrator
rights.

Use `MECHANE_WORKSPACE_ID` or `--workspace` to select shared work. An inaccessible selection fails without falling back
to a personal workspace. The [command model](../packages/node/commands/src/declarations/access/workspace-commands.ts)
owns membership commands and flags.

An installation administrator can set policy without joining the workspace. Read the current policy before replacing it,
and choose all four values within the installation's limits:

```sh
mechane workspace policy show WORKSPACE_UUID
mechane workspace policy set WORKSPACE_UUID --suspended false --sandboxes true --machines 4 --daily-allowance-micros 20000000
```

This example allows four machines and a daily model allowance of $20. Suspension refuses subsequent member requests and
new work; it does not delete files. Infrastructure applies preserve runtime membership, policy, credentials, Slack
bindings, and agents.

## Sandboxes

Cloud containers are disposable. Mechane checkpoints `/home/node` to R2 before reporting a command as durably complete,
then restores those files into replacement machines. Background processes and unfinished writes have no persistence
guarantee. Keep an export before deliberate file replacement or deletion:

```sh
mechane sandbox show MECH_ID
mechane sandbox export MECH_ID --file ./workspace.tar.gz
```

For an idle sandbox, use `sandbox import MECH_ID --file ./workspace.tar.gz --confirm` to restore an archive, or
`sandbox upgrade MECH_ID` to replace its machine while preserving home files. Active turns and running drones refuse
maintenance. Add `--drone DRONE_ID` to manage a finished drone.

Tensorlake execution is retired. Before upgrading an older Tensorlake installation, export its native files and finish
native maintenance on the previous release. Configure containers, then import the archive with the commands above. The
retained native-file guard refuses execution until verified import commits the replacement. Existing container
workspaces use the same R2 generations throughout the upgrade.

Each mutation prints an operation ID. After interruption, retry with `--operation-id ID` or inspect progress with
`sandbox show`. Use `sandbox cancel MECH_ID --operation-id ID` to discard an uncommitted replacement. Failed maintenance
requires cancellation before another change. Imports preserve the previous committed snapshot until verification
succeeds.

Exports contain sandbox files, not agent databases or credentials. Keep archives private. The
[sandbox implementation guide](../packages/worker/sandbox/README.md#workspace-durability) explains checkpoint failures,
archive limits, and provider migration boundaries.

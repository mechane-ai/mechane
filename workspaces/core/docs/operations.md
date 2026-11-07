# Operate Mechane

Keep one infrastructure declaration and state owner for each installation. The service, database, compute, secrets, and
domain belong to that owner. Product records are administered through Mechane's authenticated APIs.

## Changes

Select immutable runtime and sandbox artifacts from the same release. Verify the manifest's revision and checksums
before constructing the host image. Do not rebuild application JavaScript from an operator checkout.

Run domain and upstream adapter schema bootstrap with the migration credential. Keep that credential out of the serving
process. Rolling updates require schema changes that both the current and replacement service can use. The
[schema 1 upgrade](#upgrade-domain-schema-1-to-2) requires a stopped service instead. Native Workflow state, SDK
serialization, and open hooks remain part of the compatibility boundary after the initial hard cutover.

Deploy the Node process with its private configuration, health checks, and a bounded shutdown interval. Keep the
Workflow worker running with HTTP service lifetime. A rolling replacement may overlap processes; database claims and
stable side-effect identities must coordinate them. The public origin and GitHub callback remain stable.

Review the infrastructure plan for unintended database, sandbox namespace, bucket, or key replacement. Serialize the
plan-and-apply sequence, and discard a saved plan after an intervening apply or configuration change. A successful
follow-up plan reports no changes. Keep protected state backups outside Git.

An infrastructure apply proves resource convergence, not agent behavior. Check health and readiness, sign-in, workspace
reads, an admitted input, its stream, and a sandbox command. For an SDK or execution change, verify restart while
waiting for approval and automatic continuation to the original Slack thread. Record paid/live checks in the delivery
issue with the source revision, deployed artifact, and remaining limits.

## Recovery

After an interrupted deployment, read the active host revision, database schema, and compute rollout before retrying.
Reuse the same resource identities and state. Never recreate a database, namespace, or bucket merely to clear an error.
A process restart should resume Workflow-owned work, not submit a replacement input.

After an uncertain command, inspect its original execution receipt. A lost HTTP response is not evidence that a push,
merge, deployment, or other external write failed. Inspect the external system before deciding whether to repeat it.
Reply delivery has a separate receipt; a failed Slack post does not rerun the agent's completed work.

Stop competing infrastructure writers before recovering a retained state lock. Confirm the exact state key and lock
identity. Lock age or a matching username does not prove a writer is dead. Do not disable locking or overwrite unseen
remote state. Infrastructure-state recovery does not restore application data.

Keep database backups, workspace checkpoints, and vault key versions together in the recovery plan. Changing a release
URL cannot reverse a migration or recover deleted records. Publish compatible recovery code under a new immutable
release when the active schema or Workflow histories cannot use an older artifact.

## Secrets

Deployment secret stores own OAuth, model, database, vault, sandbox, and callback credentials. Update only the intended
installation's reference. A secret shared by several services changes all of them; use dedicated references.

Rotate OAuth and model credentials by installing a replacement, verifying a fresh use, and then revoking the previous
credential when overlap is supported. Runtime configuration resolves values at the trusted operation boundary. Never
include secret values in a deployment manifest or command argument.

To rotate vault encryption, add a new key version and select it as current while retaining prior versions. Workspace
owners then resubmit retained credentials under their existing references using private files:

```sh
mechane --workspace WORKSPACE_UUID credential put REFERENCE --file /private/path/credential
mechane --workspace WORKSPACE_UUID credential list
```

A write encrypts with a fresh nonce and the current key. Keep an old key until no retained credential or backup needs
it. Losing that key makes its ciphertext unreadable. Credential metadata reports versions but never values.

## Access

Admit GitHub identities by stable numeric subject, not username. Installation administration and workspace ownership are
separate grants. Use the current CLI help to create shared workspaces and change membership. Preserve at least one
workspace owner. An inaccessible selected workspace must fail rather than silently select personal work.

Workspace owners configure integration credentials and per-mech execution access. Review the current grant before
replacing it. A removed credential must not leave a silently usable configuration. Grant revocation affects later
issuance; it cannot undo an already-authorized external effect.

Nexus owns capability policy and approval decisions. Configure its runtime event destination and shared signing secret
through trusted deployment configuration. Models do not choose callback URLs. A ready decision still requires checking
the current request/grant before use. The runtime's accepted decision receipt prevents duplicate continuation.

## Sandboxes

A container is disposable; its committed files are durable. The sandbox service checkpoints the owned home directory
before recording a completed command. A replacement restores the committed generation before accepting new work.
Unfinished writes and background processes have no persistence guarantee.

Preserve the previous committed checkpoint after a failed save. Use the sandbox service's explicit maintenance and
receipt interfaces for inspection, cancellation, or replacement. Keep exports private, and never delete a namespace or
bucket as a substitute for canceling one operation. See the [sandbox guide](../packages/worker/sandbox/README.md) for
archive bounds and recovery semantics.

### Image changes

Save and retire guests before applying a different guest image. Provider 0.10.0 uses a `full_auto` rolling replacement
and does not request a fresh file checkpoint. Its grace period and a healthy replacement do not prove that current files
were saved. Require a completed fresh checkpoint, guest retirement, confirmed provider stop, and released capacity
before the image apply. Preserve the checkpoint bucket and Durable Object namespace.

### Upgrade domain schema 1 to 2

Releases 0.25.0 and 0.25.1 require schema 1 and cannot restart after 0.25.2 migrates it. Use this stopped-service
procedure; the old sandbox service's stop operation does not create a fresh checkpoint.

1. Drain unfinished domain and Workflow work, including approval waits. Keep the old Node and sandbox service running.
2. While workspace policy permits sandboxes and capacity is available, run a fresh same-image upgrade for each live
   guest:

   ```sh
   mechane --origin ORIGIN --workspace WORKSPACE --output json sandbox upgrade MECH --operation-id FRESH_UUID
   ```

   Retry an interrupted operation with the same UUID. Require the matching `operation_id`, `action: "upgrade"`, and
   `phase: "done"`. Retain that report, its replacement `sandbox_id`, and a representative home-file hash when
   available. Old reports expose no checkpoint ID. Reusing an earlier completed UUID does not save current files.

3. Recheck idle work and save each affected workspace's exact policy. Suspend execution through its policy, preserving
   the other fields. Recheck for work admitted during that interval. If any appeared, restore the saved policies, finish
   it on the old release, and repeat the fresh checkpoint and fence. Do not migrate past an unresolved race.
4. Retire guests through authenticated `POST /internal/sandboxes/{workspaceId}/{mechId}/stop` at
   `MECHANE_SANDBOX_ORIGIN`, using the existing sandbox-service credential. There is no public stop CLI. Poll the
   corresponding internal `GET .../workspace`: saved homes must report `sandbox_id: null` and `status: "sleeping"`. Also
   require the corresponding provider instances to be stopped and capacity reservations released. An accepted stop
   response or a sleeping report alone is insufficient. Keep old Node available through the capacity-release callbacks.
5. Stop the whole old Node application, including instances maintained by minimum capacity. Audit all workspaces for
   unfinished domain/Workflow work and active runtime database sessions. Resolve any race on the old release before
   continuing. Take an authoritative database backup and retain vault keys, checkpoint files, and resource identities.
6. Migrate to schema 2, deploy the matching new Node and sandbox artifacts, and apply the image with all old guests
   already stopped. Keep policies suspended while checking readiness, preserved records, checkpoint metadata, and
   provider rollout completion.
7. Restore the exact saved policies before allocating guests for qualification. Verify a fresh guest's image, restored
   files, browser action, and saved evidence before declaring the rollout complete. Then verify the original agent flow.
   Recover forward after migration; the schema 1 binary cannot serve the migrated database.

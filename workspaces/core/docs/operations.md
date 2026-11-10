# Operate Mechane

Keep one infrastructure declaration, state owner, and deployment writer per installation. Preserve the Worker identity,
Durable Object namespaces, checkpoint bucket, database, and encryption keys across application updates.

## Artifacts

Install qualified bytes from one immutable release. Keep the candidate directory intact beside its independently
selected qualification digest. The [distribution guide](../packages/node/distribution/README.md) defines its inventory
and the [provider](../infrastructure/provider/README.md) verifies it before cloud requests.

Release qualification follows this sequence:

1. Build a candidate from reviewed, clean public source with `mise -C workspaces/core run distribution:build`.
2. Verify the candidate with `mise -C workspaces/core run distribution:verify -- CANDIDATE`.
3. Run complete repository checks, compiled-artifact scenarios, and shipped-format preservation checks against those
   exact bytes. Use the [stack API](../packages/node/stack/src/types.ts) with `isSource: false` and the candidate's
   `serverEntry`, `assetsDirectory`, and `sandboxImage`. Artifact mode copies the Worker without watching or recompiling
   it.
4. Retain exact toolchain, fixture, policy, and configuration inputs with their digests. Prepare the
   [qualification request](../packages/node/distribution/src/qualification.ts) with successful `complete`,
   `artifact-scenarios`, and `shipped-formats` evidence. Each report binds the same source, inventories, and input
   digest.
5. Run `mise -C workspaces/core run distribution:qualify -- CANDIDATE REQUEST.json`, then independently select the
   resulting `qualification.json` SHA-256.
6. Run `mise -C workspaces/core run distribution:verify-qualified -- CANDIDATE QUALIFICATION_SHA256`. Publish and
   install that same candidate with every referenced file. Changed bytes or inputs require new qualification.

Qualification and verification do not rebuild or publish. Operators supply `qualification.path` and
`qualification.sha256` to the installation module. Source tests and celld results do not establish hosted behavior.
After an authorized deployment, verify actual Console assets, intake, execution, restart recovery, and explicit tool
communication. Record the deployed identities and remaining limits with the receipts.

## Cutover

Retire the previous execution engine before activating a native actor. Preserve actual Postgres history, pending input,
credentials, workspace files, checkpoint failures, and uncertain receipts.

1. Save each workspace's exact policy and suspend execution. Quiesce native actors through the authenticated
   [maintenance operation](../packages/shared/protocol/src/operations/mechs/maintenance.schemas.ts) when applicable.
   Reconcile in-flight model and environment effects using their existing identities.
2. Save current files and complete sandbox retirement through the [stop procedure](#stopping). Keep capacity callbacks
   available until release completes. Preserve an authoritative database backup and required key versions.
3. Positively retire every old application owner, automatic replica, and restart controller. Reconcile provider
   inventory and runtime database sessions. Retain operator-reviewed retirement evidence; stored run status cannot prove
   process retirement.
4. Run the extracted release's `node migrate.mjs`, then `node grant.mjs` with the controlled migration connection.
   Follow the [database inputs](self-hosting.md#install). Steps 1–5 keep their exact checksums; schema 6 adds control
   accounting and delivery tables. Historical records and tables remain.
5. Deploy the qualified Worker while policies remain suspended. Preserve the existing Sandbox namespace, container
   application, and checkpoint bucket. Fence integration delivery at the Worker while preserving producers' durable
   outboxes. Keep direct member and Console submissions quiet. Quiesce every fresh target actor through the
   authenticated maintenance operation before its first import batch. Suspension alone permits notification intake.
   Verify readiness, the intake fence, and retained authority before importing histories.
6. Inventory and apply preserved history with the extracted command:

   ```sh
   node import.mjs --dry-run --all
   node import.mjs --apply --all --expect-digest SOURCE_SHA256 --retirement-receipt RETIREMENT.json --retirement-sha256 RETIREMENT_SHA256
   ```

   Both modes read `MECHANE_MIGRATION_DATABASE_URL`. Apply also reads `MECHANE_ORIGIN` and
   `MECHANE_SANDBOX_SERVICE_KEY`. Use `--workspace UUID`, optionally with `--mech UUID`, instead of `--all` for a
   smaller selection. Review the same selection's source digest and the retirement receipt's exact bytes before
   applying.

7. Check authenticated Conversation and trace reads, retained publications, pending input, and checkpoint markers. Final
   import leaves the actor inactive. Remove the intake fence after all selected scopes pass verification; require
   durable producer deliveries to resume. Deliberately resume eligible actors and restore exact saved policies only
   after checking the maintenance receipt and environment recovery state.

When file recovery requires the new Worker, first prove the old application is quiet. Preserve the live guest and its
held reservation, retire the old application, and migrate control storage. Stage only the qualified Worker with intake
fenced; keep the old image unchanged. Complete file recovery, Stop, and capacity release before import and image
rollout.

The importer uses a consistent read-only source snapshot and rechecks suspension before each delivery batch. Oversized
records fail preflight without truncation. After a lost acknowledgment, rerun the same reviewed command; immutable
identities and cursors reject changed batches. The [import guide](../packages/worker/server/src/import/README.md)
describes its output and guard.

The migrator validates the contiguous ledger and known checksums. It refuses a database newer than its release. Verify
older Console UUID repairs through authenticated reads and repeat migration without changing repaired or valid records.
Recover forward after this engine cutover; an old execution binary is not a code-only rollback.

## Stopping

Fence new execution before replacing a guest image or stopping a retained installation. Enumerate held capacity owners
through authenticated `GET /internal/sandbox-owners`. Request each environment's stop through
`POST /internal/sandboxes/WORKSPACE_ID/MECH_ID/stop` at its sandbox origin using the service credential.

Retain the returned `operation_id`. Passively inspect `GET /internal/sandboxes/WORKSPACE_ID/MECH_ID/stop/OPERATION_ID`
after a lost response or while waiting. The [receipt](../packages/shared/sandbox-wire/src/environment-state.ts)
distinguishes `requested`, `waiting_for_commands`, `checkpointing`, `stopping`, `completed`, and `failed`.

An accepted stop does not establish saved files or provider retirement. Require a fresh committed generation, completed
stop, matching capacity release, and reconciled provider inventory before changing the image. Verify restored files
after rollout. Keep the namespace and checkpoint bucket intact.

Follow the receipt's `recovery_action`: wait, repair the workspace, or explicitly retry stop. Passive reads do not retry
shutdown or repair files. Preserve live files and the previous committed generation after checkpoint failure. The
retained local supervisor leaves hosts available if draining fails or exceeds its deadline.

## Recovery

Inspect the original turn and effect receipts after interruption. A restart resumes Pi-owned work; submitting another
notification creates new input. A lost HTTP response does not prove an external write failed. Inspect its external
outcome before authorizing another effect.

Native traces describe actor-owned turns, provider attempts, and tools. Imported traces retain historical provenance and
an explicit evidence notice; importing them never replays tools or publications. Pending historical notifications and
uncertain executions remain evidence for later reconciliation.

Provider attempts reserve before dispatch and recheck current policy and caps at dispatch admission. Confirmed usage
settles once; unknown dispatched attempts remain charged. Only an undispatched reservation can be released as unused. Do
not repeat a paid request or completed tool to recover missing output.

Preserve an unresolved environment-checkpoint requirement until its recovery succeeds. A terminal turn, older snapshot,
or healthy replacement cannot prove newer writes survived. Inspect retained recovery files before deciding whether any
loss is acceptable.

## Secrets and access

Keep migration credentials out of Worker bindings. Rotate deployment secrets through their installation references and
verify fresh use before revoking an overlapping old credential. Keep previous vault keys while retained ciphertexts or
backups require them.

Admit GitHub identities by stable numeric subject. Preserve at least one workspace owner and keep installation
administration separate from membership. Owners configure credentials and execution grants through authenticated APIs.
Revocation affects later authorization; it cannot undo an admitted external effect.

# Operate Mechane

Keep one infrastructure declaration, state owner, and deployment writer per installation. Preserve the Worker identity,
Durable Object namespaces, checkpoint bucket, database, and encryption keys across application updates.

## Artifacts

Install qualified bytes from one immutable release. Keep the candidate directory intact beside its independently
selected qualification digest. The [distribution guide](../packages/node/distribution/README.md) defines its inventory
and the [provider](../infrastructure/provider/README.md) verifies it before cloud requests.

Release acceptance follows this sequence:

1. Run `mise -C workspaces/core run distribution:candidate -- CANDIDATE` from reviewed, clean public source. It builds
   once, runs static checks and the complete artifact catalog, and generates qualification reports. For existing built
   bytes, use `distribution:accept -- CANDIDATE ARTIFACTS_SHA256` without rebuilding.
2. Independently select the resulting `qualification.json` SHA-256 and run
   `mise -C workspaces/core run distribution:verify-qualified -- CANDIDATE QUALIFICATION_SHA256`.
3. Publish and install those exact bytes with every referenced file. Changed bytes or inputs require new acceptance.

Acceptance of existing bytes and verification do not rebuild or publish. Operators supply `qualification.path` and
`qualification.sha256` to the installation module. Child progress stays on standard error; final qualification JSON
stays on standard output. Cached development results do not replace candidate acceptance.

After authorized deployment, verify serving artifact identity, health, readiness, and actual Console assets. Qualify
changed hosted boundaries separately: celld cannot establish Cloudflare routing or containment. Integration changes
retain their actual delivery and human-approval receipts. Record observed identities and remaining limits with delivery
work rather than assembling another qualification path.

## Cutover

Use a forward-only cutover when an authorized change replaces an execution owner or narrows stored data. Preserve actual
history, pending input, credentials, workspace files, checkpoint failures, and uncertain receipts. An application-only
update does not require repeating a completed engine migration.

1. Fence affected admission and record current policy. Quiesce actors through the authenticated
   [maintenance operation](../packages/shared/protocol/src/operations/mechs/maintenance.schemas.ts), then reconcile
   in-flight effects under their existing identities.
2. Before physical guest replacement, complete the fresh file drain, provider retirement, and capacity release described
   under [stopping](#stopping). Keep required callbacks serving until retirement is confirmed.
3. Positively retire superseded writers before a narrowing migration. Preserve the database backup and required key
   versions. Run only the controlled database commands the actual schema requires, with separate migration authority.
4. Import history only when retained data needs conversion. Use the owning
   [import guide](../packages/worker/server/src/import/README.md), its reviewed source digest, and retirement evidence.
   Imported events remain evidence; they cannot replay effects, activate an agent, or clear maintenance holds.
5. Verify migrated and unchanged records through authenticated product reads. Preserve namespace, bucket, database, and
   resource identities. Restore exact saved policies deliberately and activate one execution owner.

If file recovery needs new application code, preserve the live guest and reservation while updating that owner; keep the
image unchanged until recovery and Stop complete. Recover forward after a narrowing. A retired execution binary is not a
code-only rollback, and an old committed head is not evidence that newer live writes survived.

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

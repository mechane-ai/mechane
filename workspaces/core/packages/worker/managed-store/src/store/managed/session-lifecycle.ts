import { managedDocument, ManagedStoreError, updateManagedSessionBudget } from '@mechane/authority-store';
import type { ManagedDocument, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { sessionTitle, updateSessionAgent } from './session-configuration.ts';
import { requireBudgetable } from './session-create.ts';
import type { BudgetModelValidator } from './session-create.ts';
import { readSession, sessionDocument } from './session-records.ts';
import type { SessionIdentity } from './session-records.ts';
import { patchMetadata } from './vault-fields.ts';
import { closeSessionWork } from './work-records.ts';

const MUTABLE_FIELDS: ReadonlySet<string> = new Set(['title', 'metadata', 'agent', 'budget']);

type SessionUpdate = SessionIdentity & {
  readonly changes: ManagedDocument;
  readonly forwardMetadata: ReadonlyArray<string>;
  readonly validateBudgetModels?: BudgetModelValidator;
};

export async function updateSession(
  context: StoreContext,
  { scope, id, changes, validateBudgetModels, forwardMetadata }: SessionUpdate,
) {
  const row = await readSession(context, { scope, id }, true);

  if (row.archived_at !== null) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Cannot update an archived session');
  }

  if (Record.keys(changes).some((key) => !MUTABLE_FIELDS.has(key))) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unsupported session update');
  }

  const current = row.configuration;
  const next = { ...current, metadata: patchMetadata(current.metadata, changes['metadata']) };

  if (forwardMetadata.some((key) => current.metadata[key] !== next.metadata[key])) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Forwarded session metadata is immutable');
  }

  if ('title' in changes) {
    if (changes['title'] === '') {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Session title must not be empty');
    }

    next.title = sessionTitle(changes['title']);
  }

  if ('agent' in changes) {
    next.agent = updateSessionAgent(current.agent, managedDocument(changes['agent'], 'agent'));
  }

  if ('budget' in changes) {
    if (changes['budget'] !== null) {
      await requireBudgetable(next.agent, validateBudgetModels);
    }

    await updateManagedSessionBudget(context, {
      workspaceId: scope.workspaceId,
      sessionId: id,
      budget: changes['budget'],
    });
  }

  await context.client.query(
    `UPDATE mechane.managed_sessions SET configuration=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2
     AND (configuration IS DISTINCT FROM $3 OR $4)`,
    [scope.workspaceId, id, JSON.stringify(next), 'budget' in changes],
  );

  return await sessionDocument(context, await readSession(context, { scope, id }));
}

export async function archiveSession(transaction: StoreContext, identity: SessionIdentity) {
  await readSession(transaction, identity, true);
  await transaction.client.query(
    `UPDATE mechane.managed_sessions SET archived_at=now(),updated_at=now(),status='terminated',
       status_at=CASE WHEN status='terminated' THEN status_at ELSE now() END
     WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [identity.scope.workspaceId, identity.id],
  );
  await closeSessionWork(transaction, { workspaceId: identity.scope.workspaceId, sessionId: identity.id });

  return await sessionDocument(transaction, await readSession(transaction, identity));
}

export async function deleteSession(transaction: StoreContext, identity: SessionIdentity) {
  await readSession(transaction, identity, true);
  await transaction.client.query('DELETE FROM mechane.managed_sessions WHERE workspace_id=$1 AND id=$2', [
    identity.scope.workspaceId,
    identity.id,
  ]);

  return { id: identity.id, type: 'session_deleted' };
}

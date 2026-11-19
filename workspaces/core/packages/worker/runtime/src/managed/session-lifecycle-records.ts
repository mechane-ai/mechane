import { defineDoc, defineDocFamily } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { fingerprint } from '../actor/state.ts';
import { failManagedRequest } from './failure.ts';
import { ManagedSessionMutation } from './protocol.ts';
import { sessionState } from './scheduler.ts';
import { readManagedSessionState } from './thread-state.ts';

export const SessionMutation = defineDoc({
  kind: 'managed.session-mutation',
  version: 1,
  scope: 'session',
  initial: () => ({ request: '', environmentId: '', digest: '' }),
  checkpointWhen: () => true,
});

const Completed = defineDocFamily({
  kind: 'managed.completed-session-mutation',
  version: 1,
  family: true,
  scope: 'session',
  initial: (_seed: null): { readonly digest: string; readonly status: string | null } => ({ digest: '', status: null }),
  checkpointWhen: () => true,
});

export function lifecycleRequest(raw: string) {
  const value: unknown = JSON.parse(raw);

  return Schema.decodeUnknownSync(ManagedSessionMutation)(value);
}

export async function prepareSessionMutation(transaction: Tx, input: ManagedSessionMutation) {
  const digest = await fingerprint(input);
  const completed = await transaction.doc(Completed, input.mutationId, null);

  if (completed.digest !== '') {
    if (completed.digest !== digest) {
      failManagedRequest(HttpStatusCode.Conflict, 'Mutation identity has different content');
    }

    return { isCompleted: true, environmentId: '', status: completed.status } as const;
  }

  const state = await sessionState(transaction, input.sessionId);
  const mutation = await transaction.doc(SessionMutation);

  if (state.mutationId !== null) {
    if (state.mutationId !== input.mutationId || mutation.digest !== digest) {
      failManagedRequest(HttpStatusCode.Conflict, 'Another session mutation is pending');
    }

    return { isCompleted: false, environmentId: mutation.environmentId } as const;
  }

  const activity = await readManagedSessionState(transaction, input.sessionId);

  if (input.kind === 'update' && (state.isArchived || activity.status === 'terminated')) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Cannot update a terminated session');
  }

  if (activity.status === 'running' && (input.kind !== 'update' || Object.hasOwn(input.changes ?? {}, 'agent'))) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Interrupt the running session first');
  }

  state.mutationId = input.mutationId;
  mutation.request = JSON.stringify(input);
  mutation.environmentId = state.environmentId;
  mutation.digest = digest;

  return { isCompleted: false, environmentId: mutation.environmentId } as const;
}

export async function releaseSessionMutation(
  transaction: Tx,
  input: ManagedSessionMutation,
  result: { readonly isApplied: false } | { readonly isApplied: true; readonly status: string | null },
): Promise<void> {
  if (result.isApplied) {
    const completed = await transaction.doc(Completed, input.mutationId, null);
    completed.digest = await fingerprint(input);
    completed.status = result.status;
  }

  await transaction.retireDoc(SessionMutation);
}

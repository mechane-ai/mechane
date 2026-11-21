import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineDocFamily } from '@earendil-works/pi-durable';
import type { Session, Tx } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { fingerprint } from '../../actor/state.ts';
import type { ManagedAgentScope } from '../protocol.ts';
import type { ManagedDelegationOpen, ManagedDelegationOrigin } from './protocol.ts';

type DelegatedFocus = {
  readonly identity: string;
  readonly descriptor: string;
  readonly state: 'active' | 'stopping' | 'stopped';
};

export const Origins = defineDocFamily<DelegatedFocus, null>({
  kind: 'managed.delegation-origin',
  version: 1,
  family: true,
  scope: 'session',
  checkpointWhen: () => true,
  initial: () => ({ identity: '', descriptor: '', state: 'active' }),
});

export function missing(): never {
  failManagedRequest(HttpStatusCode.NotFound, 'Delegated session thread not found');
}

export function validateScope(scope: ManagedAgentScope, origin: ManagedDelegationOrigin): void {
  if (scope.workspaceId !== origin.workspaceId || scope.agentId !== origin.childAgentId) {
    missing();
  }

  if (
    !origin.threadId.startsWith('sthr_') ||
    !origin.sessionId.startsWith('sesn_') ||
    origin.parentThreadId === origin.threadId
  ) {
    missing();
  }
}

export function assertDelegationOpen(scope: ManagedAgentScope, { origin, session }: ManagedDelegationOpen): void {
  validateScope(scope, origin);

  if (
    session.sessionId !== origin.sessionId ||
    session.threadId !== origin.threadId ||
    session.agent['id'] !== origin.childAgentId
  ) {
    missing();
  }
}

export async function verifyOrigin(transaction: Tx, threadId: string, identity: string) {
  const owner = await transaction.doc(Origins, threadId, null);

  if (owner.identity === '' || owner.identity !== identity) {
    missing();
  }

  return owner;
}

type OriginAccess = {
  readonly scope: ManagedAgentScope;
  readonly origin: ManagedDelegationOrigin;
  readonly access: 'active' | 'recover';
};

export async function withDelegationOrigin<T>(
  harness: Session,
  { scope, origin, access }: OriginAccess,
  operation: (transaction: Tx) => Promise<T>,
): Promise<T> {
  validateScope(scope, origin);

  const identity = await fingerprint(origin);

  return await harness.commit(async (transaction) => {
    const owner = await transaction.doc(Origins, origin.threadId, null);

    if (access === 'recover' && owner.identity === '') {
      owner.identity = identity;
    }

    if (owner.identity !== identity) {
      missing();
    }

    if (access === 'active' && owner.state !== 'active') {
      failManagedRequest(HttpStatusCode.Conflict, 'This delegated thread has ended');
    }

    return await operation(transaction);
  }, BACKGROUND_CONTEXT);
}

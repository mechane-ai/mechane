import { decodeManagedInput } from '@mechane/model-gateway';
import { fingerprint } from '../actor/state.ts';
import {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationLeaseLoss,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationRead,
  ManagedDelegationSend,
} from './delegation/protocol.ts';
import { assertDelegationOpen, validateScope } from './delegation/receiver-origin.ts';
import { managedWriteOperations } from './operations.ts';
import { ManagedDelegationPreview } from './preview-coordinates.ts';
import { ManagedSessionMutation, ManagedSessionOpen, ManagedSessionReference } from './protocol.ts';
import type { ManagedAgentScope } from './protocol.ts';
import type { SessionRoute } from './store/session-meta.ts';

function delegatedOrigin(scope: ManagedAgentScope, method: string, input: unknown) {
  switch (method) {
    case 'delegatePreviews':
      return decodeManagedInput(ManagedDelegationPreview, input).origin;
    case 'delegateOpen': {
      const opened = decodeManagedInput(ManagedDelegationOpen, input);

      assertDelegationOpen(scope, opened);

      return opened.origin;
    }
    case 'delegateUpdateBudget':
      return decodeManagedInput(ManagedDelegationBudgetUpdate, input).origin;
    case 'delegateRead':
      return decodeManagedInput(ManagedDelegationRead, input).origin;
    case 'delegateLoseWorkerLease':
      return decodeManagedInput(ManagedDelegationLeaseLoss, input).origin;
    case 'delegateSend':
      return decodeManagedInput(ManagedDelegationSend, input).origin;
    case 'delegateStop':
    case 'delegateDelete':
      return decodeManagedInput(ManagedDelegationOrigin, input);
    default:
      return null;
  }
}

const terminatingDelegations: ReadonlySet<string> = new Set(['delegateDelete', 'delegateStop']);

const creatableDelegations: ReadonlySet<string> = new Set([
  'delegateOpen',
  'delegateStop',
  'delegateDelete',
  'delegateLoseWorkerLease',
]);

export async function managedSessionRoute(
  scope: ManagedAgentScope,
  method: string,
  input: unknown,
): Promise<SessionRoute> {
  const origin = delegatedOrigin(scope, method, input);
  const isWrite = managedWriteOperations.has(method);

  if (origin !== null) {
    validateScope(scope, origin);

    const route: SessionRoute = {
      id: origin.threadId,
      publicId: origin.sessionId,
      isStream: method === 'delegatePreviews',
      origin: await fingerprint(origin),
      canCreate: creatableDelegations.has(method),
      isWrite,
    };

    if (terminatingDelegations.has(method)) {
      return { ...route, terminal: { receipt: null, result: true } };
    }

    if (method === 'delegateLoseWorkerLease') {
      return { ...route, terminal: { receipt: null, result: 0 } };
    }

    return route;
  }

  const { sessionId } = decodeManagedInput(ManagedSessionReference, input);

  if (method === 'open') {
    decodeManagedInput(ManagedSessionOpen, input);
  }

  const result = {
    id: sessionId,
    publicId: sessionId,
    origin: null,
    canCreate: method === 'open',
    isStream: method === 'stream',
    isWrite,
  };

  if (method !== 'mutateSession') {
    return result;
  }

  const mutation = decodeManagedInput(ManagedSessionMutation, input);

  if (mutation.kind !== 'delete') {
    return result;
  }

  return {
    ...result,
    terminal: { receipt: await fingerprint(mutation), result: { id: sessionId, type: 'session_deleted' } },
  };
}

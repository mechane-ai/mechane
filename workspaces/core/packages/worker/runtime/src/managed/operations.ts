import { HttpStatusCode } from '@mechane/records';
import type { ManagedAgentRuntime } from './client.ts';
import {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationLeaseLoss,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationSend,
} from './delegation/protocol.ts';
import {
  receiveDelegationBudgetUpdate,
  receiveDelegationDelete,
  receiveDelegationOpen,
  receiveDelegationSend,
  receiveDelegationStop,
} from './delegation/receiver.ts';
import { receiveDelegateWorkerLeaseLoss } from './delegation/worker-loss.ts';
import type { ManagedAgentEngine } from './engine.ts';
import { decodeManagedInput, failManagedRequest } from './failure.ts';
import type { ManagedAgentScope } from './protocol.ts';
import {
  ManagedSessionMutation,
  ManagedSessionOpen,
  ManagedSessionSend,
  ManagedSessionThreadReference,
  ManagedWorkerLease,
} from './protocol.ts';
import { recoverManagedWorkerLease } from './worker-loss.ts';

type Operation = {
  readonly scope: ManagedAgentScope;
  readonly method: string;
  readonly input: unknown;
  readonly engine: ManagedAgentEngine;
};

export const managedWriteOperations: ReadonlySet<string> = new Set<keyof ManagedAgentRuntime>([
  'open',
  'send',
  'mutateSession',
  'archiveThread',
  'delegateUpdateBudget',
  'delegateOpen',
  'delegateSend',
  'delegateStop',
  'delegateDelete',
  'loseWorkerLease',
  'delegateLoseWorkerLease',
]);

export async function runManagedOperation({ method, input, engine, scope }: Operation): Promise<Response> {
  switch (method) {
    case 'loseWorkerLease':
      await recoverManagedWorkerLease(engine, decodeManagedInput(ManagedWorkerLease, input));

      return Response.json(null);
    case 'delegateUpdateBudget':
      return Response.json(
        await receiveDelegationBudgetUpdate(engine, scope, decodeManagedInput(ManagedDelegationBudgetUpdate, input)),
      );
    case 'delegateDelete':
      return Response.json(
        await receiveDelegationDelete(engine, scope, decodeManagedInput(ManagedDelegationOrigin, input)),
      );
    case 'delegateLoseWorkerLease':
      return Response.json(
        await receiveDelegateWorkerLeaseLoss(engine, scope, decodeManagedInput(ManagedDelegationLeaseLoss, input)),
      );
    case 'delegateStop':
      return Response.json(
        await receiveDelegationStop(engine, scope, decodeManagedInput(ManagedDelegationOrigin, input)),
      );
    case 'delegateOpen':
      return Response.json(
        await receiveDelegationOpen(engine, scope, decodeManagedInput(ManagedDelegationOpen, input)),
      );
    case 'delegateSend':
      return Response.json(
        await receiveDelegationSend(engine, scope, decodeManagedInput(ManagedDelegationSend, input)),
      );
    case 'open':
      return Response.json(await engine.open(decodeManagedInput(ManagedSessionOpen, input)));
    case 'send':
      return Response.json(await engine.send(decodeManagedInput(ManagedSessionSend, input)));
    case 'archiveThread':
      return Response.json(await engine.archiveThread(decodeManagedInput(ManagedSessionThreadReference, input)));
    case 'mutateSession':
      return Response.json(await engine.mutateSession(decodeManagedInput(ManagedSessionMutation, input)));
    default:
      return failManagedRequest(HttpStatusCode.NotFound, 'Unknown managed agent operation');
  }
}

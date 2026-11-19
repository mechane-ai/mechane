import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import type { ManagedAgentEngine } from '../engine.ts';
import { clearLostWorkerCall } from '../local-worker-loss.ts';
import type { ManagedAgentScope, ManagedWorkerLease } from '../protocol.ts';
import { Sessions } from '../scheduler.ts';
import { liveThreadIds } from '../thread-records.ts';
import { exposedWorkerCall } from '../worker-exposure.ts';
import { applyPage } from './dispatch.ts';
import type { DelegationTarget } from './dispatch.ts';
import { pendingChildCalls } from './inputs.ts';
import type { ManagedDelegationLeaseLoss } from './protocol.ts';
import { withDelegationOrigin } from './receiver-origin.ts';
import { ActiveChildren, Children } from './records.ts';
import type { Child } from './records.ts';

export async function receiveDelegateWorkerLeaseLoss(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  input: ManagedDelegationLeaseLoss,
): Promise<number> {
  const { threadId } = input.origin;

  const { changed, offset } = await withDelegationOrigin(
    engine.harness,
    { scope, origin: input.origin, access: 'recover' },
    (transaction) => clearLostWorkerCall(transaction, { sessionId: threadId, leaseId: input.leaseId }, input.toolUseId),
  );

  if (changed) {
    engine.options.wake();
  }

  return offset;
}

type Mirror = { readonly child: Child; readonly through: number };

async function projectThrough(harness: Harness, target: DelegationTarget, { child, through }: Mirror) {
  let current = child;

  while (current.offset < through) {
    const page = await target.delegateRead({ origin: current.origin, offset: current.offset });

    if (page.data.length === 0 || page.offset !== current.offset + page.data.length) {
      throw new Error('The delegated thread has not exposed its worker recovery events.');
    }

    const before = current;
    const events = page.data.slice(0, through - before.offset);
    const offset = before.offset + events.length;

    // A bounded recovery prefix cannot attest to the private child’s current tail.
    const prefix = { data: events, offset, deliveries: page.deliveries ?? {} };

    await harness.commit((transaction) => applyPage(transaction, before, prefix), BACKGROUND_CONTEXT);

    const updated = await Children.get(harness, current.origin.threadId);

    if (updated === undefined || updated.retirement !== 'live') {
      return;
    }

    if (updated.offset <= current.offset) {
      throw new Error('The delegated worker recovery events could not be published.');
    }

    current = updated;
  }
}

export async function recoverDelegateWorkerLeases(
  engine: ManagedAgentEngine,
  input: ManagedWorkerLease,
): Promise<void> {
  const children = await engine.harness.commit(async (transaction) => {
    const session = await transaction.doc(Sessions, input.sessionId, null);
    const live: Array<{ readonly child: Child; readonly toolUseId: string | null }> = [];
    const threads = await liveThreadIds(input.sessionId).allInTransaction(transaction);

    for (const threadId of threads.filter((id) => id !== session.threadId)) {
      const child = await Children.read(transaction, threadId);

      if (child === undefined || child.origin.sessionId !== input.sessionId) {
        throw new Error('The delegated worker lost its session binding.');
      }

      if (child.retirement === 'live') {
        const pending = await pendingChildCalls(input.sessionId).read(transaction, threadId);

        live.push({ child, toolUseId: await exposedWorkerCall(transaction, input, pending) });
      }
    }

    return live;
  }, BACKGROUND_CONTEXT);

  for (const { child, toolUseId } of children) {
    if (engine.options.delegate === undefined) {
      throw new Error('The delegated worker is unavailable.');
    }

    const target = engine.options.delegate(child.origin.childAgentId);
    const through = await target.delegateLoseWorkerLease({ origin: child.origin, leaseId: input.leaseId, toolUseId });

    if (toolUseId !== null) {
      const threadId = child.origin.threadId;

      const resumed = await engine.harness.commit(async (transaction) => {
        const current = await Children.read(transaction, threadId);
        const pending = await pendingChildCalls(input.sessionId).read(transaction, threadId);

        if (current?.retirement !== 'live' || pending !== toolUseId) {
          return false;
        }

        // Fence a pre-loss read before importing the effect that clears the pending call.
        await Children.put(transaction, threadId, {
          ...current,
          recoveryRevision: (current.recoveryRevision ?? 0) + 1,
        });
        await ActiveChildren.put(transaction, threadId, threadId);

        return true;
      }, BACKGROUND_CONTEXT);

      if (resumed) {
        engine.options.wake();
      }
    }

    await projectThrough(engine.harness, target, { child, through });
  }
}

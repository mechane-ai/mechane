import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { failManagedRequest } from '../failure.ts';
import type { ResolveDelegationTarget } from './dispatch.ts';
import { eraseFollowups } from './followup-fence.ts';
import { eraseChildInputReceipts } from './inputs.ts';
import { ActiveChildren, Children, pendingInputs } from './records.ts';

export async function retireDelegatedThread(transaction: Tx, sessionId: string, threadId: string): Promise<void> {
  const child = await Children.read(transaction, threadId);

  if (child === undefined || child.origin.sessionId !== sessionId || child.retirement !== 'live') {
    return;
  }

  await Children.put(transaction, threadId, { ...child, retirement: 'stop' });
  await ActiveChildren.put(transaction, threadId, threadId);
}

export async function eraseDelegatedChildren(
  harness: Harness,
  sessionId: string,
  resolve: ResolveDelegationTarget | undefined,
): Promise<void> {
  const children = await harness.commit(async (transaction) => {
    const allChildren = await Children.allInTransaction(transaction);
    const owned = allChildren.filter((child) => child.origin.sessionId === sessionId);

    for (const child of owned) {
      await Children.put(transaction, child.origin.threadId, { ...child, retirement: 'delete' });
    }

    return owned;
  }, BACKGROUND_CONTEXT);

  if (children.length > 0 && resolve === undefined) {
    failManagedRequest(
      HttpStatusCode.InternalServerError,
      'Cannot erase delegated histories without their execution owner',
    );
  }

  for (const { origin } of children) {
    if (resolve === undefined || !(await resolve(origin.childAgentId).delegateDelete(origin))) {
      failManagedRequest(HttpStatusCode.InternalServerError, 'The delegated thread has not acknowledged erasure');
    }

    await harness.commit(async (transaction) => {
      await pendingInputs(origin.threadId).retire(transaction);
      await eraseFollowups(transaction, origin.threadId);
      await ActiveChildren.remove(transaction, origin.threadId);
      await Children.remove(transaction, origin.threadId);
    }, BACKGROUND_CONTEXT);
  }

  await harness.commit((transaction) => eraseChildInputReceipts(transaction, sessionId), BACKGROUND_CONTEXT);
}

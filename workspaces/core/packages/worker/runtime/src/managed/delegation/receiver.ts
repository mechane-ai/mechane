import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Tx } from '@earendil-works/pi-durable';
import { failManagedRequest } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { actorRecordCollection } from '../../actor/record-store.ts';
import { fingerprint } from '../../actor/state.ts';
import { acceptInputs, preflightManagedEvents } from '../admission.ts';
import { applyManagedBudgetRevision } from '../budget-resume.ts';
import type { ManagedAgentEngine } from '../engine.ts';
import { sessionEvents } from '../event-log/payload-storage.ts';
import { transition } from '../lifecycle.ts';
import type { ManagedAgentScope, ManagedEvent } from '../protocol.ts';
import { Sessions, sessionState } from '../scheduler.ts';
import type { ManagedSessionReader } from '../session-reader.ts';
import { abortRetiredFocus, retireManagedFocus } from '../thread-retirement.ts';
import { readDelegationWait } from './client-wait.ts';
import { acceptFollowup } from './followup.ts';
import type {
  ManagedDelegationBudgetUpdate,
  ManagedDelegationOpen,
  ManagedDelegationOrigin,
  ManagedDelegationRead,
  ManagedDelegationSend,
} from './protocol.ts';
import {
  assertDelegationOpen,
  missing,
  Origins,
  validateScope,
  verifyOrigin,
  withDelegationOrigin,
} from './receiver-origin.ts';

const Receipts = actorRecordCollection(
  'managed.delegation-relay',
  Schema.Struct({ digest: Schema.NonEmptyString, eventIds: Schema.Array(Schema.NonEmptyString) }),
);

function relaySources(threadId: string) {
  return actorRecordCollection(`managed.delegation-source:${threadId}`, Schema.NonEmptyString);
}

function acknowledgement({ id, type, processed_at }: ManagedEvent): ManagedEvent {
  return { id, type, processed_at };
}

export async function receiveDelegationOpen(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  input: ManagedDelegationOpen,
) {
  const { origin, session } = input;

  assertDelegationOpen(scope, input);

  const identity = await fingerprint(origin);
  const descriptor = await fingerprint(session);
  const focus = { ...session, sessionId: origin.threadId };

  return await engine.open(focus, origin.sessionId, async (transaction) => {
    const owner = await transaction.doc(Origins, origin.threadId, null);

    if (owner.identity !== '' && owner.identity !== identity) {
      missing();
    }

    if (owner.state !== 'active') {
      failManagedRequest(HttpStatusCode.Conflict, 'This delegated thread has ended');
    }

    if (owner.descriptor !== '' && owner.descriptor !== descriptor) {
      failManagedRequest(HttpStatusCode.Conflict, 'The child thread already has a different pinned configuration');
    }

    owner.identity = identity;
    owner.descriptor = descriptor;
  });
}

export async function receiveDelegationRead(
  reader: ManagedSessionReader,
  scope: ManagedAgentScope,
  input: ManagedDelegationRead,
) {
  const { origin } = input;

  validateScope(scope, origin);

  const identity = await fingerprint(origin);

  await reader.harness.commit(
    (transaction) => verifyOrigin(transaction, origin.threadId, identity),
    BACKGROUND_CONTEXT,
  );

  const sources = relaySources(origin.threadId);
  const deliveries: Record<string, string> = {};

  const page = await reader.changes({ sessionId: origin.threadId, offset: input.offset }, async (id) => {
    const deliveryId = await sources.get(reader.harness, id);

    if (deliveryId === undefined) {
      return false;
    }

    deliveries[id] = deliveryId;

    return true;
  });

  const wait = await reader.harness.commit(
    (transaction) => readDelegationWait(transaction, origin.threadId, page.offset),
    BACKGROUND_CONTEXT,
  );

  return { ...page, deliveries, ...wait };
}

export async function receiveDelegationBudgetUpdate(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  { origin, revision }: ManagedDelegationBudgetUpdate,
): Promise<null> {
  const access = { scope, origin, access: 'active' } as const;

  const current = await withDelegationOrigin(engine.harness, access, async (transaction) => {
    const state = await sessionState(transaction, origin.threadId);

    return state.budgetRevision;
  });

  if (current < revision) {
    const isReached = await engine.readBudgetScope(origin.sessionId);

    await withDelegationOrigin(engine.harness, access, (transaction) =>
      applyManagedBudgetRevision(transaction, { sessionId: origin.threadId, revision, isReached }),
    );
    engine.options.wake();
  }

  return null;
}

export async function receiveDelegationSend(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  input: ManagedDelegationSend,
) {
  const { origin, events, deliveryId } = input;

  validateScope(scope, origin);

  const identity = await fingerprint(origin);
  const digest = await fingerprint(events);
  const candidate = events[0];

  function prepareAdmission() {
    if (events.length === 1 && candidate?.['type'] === 'agent.thread_message_received') {
      return async (transaction: Tx, isBudgetReached: boolean) => [
        await acceptFollowup(transaction, origin, { event: candidate, isBudgetReached }),
      ];
    }

    const validated = preflightManagedEvents(events);

    return async (transaction: Tx, isBudgetReached: boolean) =>
      await acceptInputs(
        transaction,
        { sessionId: origin.threadId, threadId: origin.threadId, isBudgetReached },
        validated,
      );
  }

  const admit = prepareAdmission();
  const receiptKey = JSON.stringify([origin.threadId, deliveryId]);

  async function current(transaction: Tx) {
    await verifyOrigin(transaction, origin.threadId, identity);

    const receipt = await Receipts.read(transaction, receiptKey);

    if (receipt !== undefined && receipt.digest !== digest) {
      failManagedRequest(HttpStatusCode.Conflict, 'The delegated delivery ID already identifies different events');
    }

    const state = await transaction.doc(Sessions, origin.threadId, null);

    if (receipt === undefined) {
      return { revision: state.budgetRevision, previous: undefined };
    }

    const previous = await Promise.all(
      receipt.eventIds.map(async (id) => {
        const row = await sessionEvents(origin.threadId).describe(transaction, id);

        if (row === undefined) {
          failManagedRequest(HttpStatusCode.InternalServerError, 'Missing admitted delegation event');
        }

        return acknowledgement(row.event);
      }),
    );

    return { revision: state.budgetRevision, previous };
  }

  async function admitAtBudgetRevision() {
    const before = await engine.harness.commit(async (transaction) => {
      const { previous, revision } = await current(transaction);

      return { previous, revision };
    }, BACKGROUND_CONTEXT);

    if (before.previous !== undefined) {
      return before.previous;
    }

    const reached = await engine.readBudgetScope(origin.sessionId);

    const admitted = await engine.harness.commit(async (transaction) => {
      const { previous, revision } = await current(transaction);

      if (previous !== undefined) {
        return previous;
      }

      if (revision !== before.revision) {
        return;
      }

      const result = await admit(transaction, reached);

      await Receipts.put(transaction, receiptKey, { digest, eventIds: result.map((event) => event.id) });

      const sources = relaySources(origin.threadId);

      for (const event of result) {
        await sources.put(transaction, event.id, deliveryId);
      }

      return result.map(acknowledgement);
    }, BACKGROUND_CONTEXT);

    return admitted;
  }

  let admitted = await admitAtBudgetRevision();

  while (admitted === undefined) {
    admitted = await admitAtBudgetRevision();
  }

  engine.options.wake();

  return admitted;
}

export async function receiveDelegationStop(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  origin: ManagedDelegationOrigin,
): Promise<boolean> {
  validateScope(scope, origin);

  const identity = await fingerprint(origin);
  const id = origin.threadId;

  const retiring = await engine.harness.commit(async (transaction) => {
    const owner = await transaction.doc(Origins, id, null);

    if (owner.identity !== '' && owner.identity !== identity) {
      missing();
    }

    owner.identity = identity;

    if (owner.state === 'stopped') {
      return false;
    }

    const state = await transaction.doc(Sessions, id, null);

    if (state.id === '') {
      owner.state = 'stopped';

      return false;
    }

    if (owner.state === 'active') {
      owner.state = 'stopping';
      state.isArchived = true;

      await retireManagedFocus(transaction, id);
      await transition(transaction, { sessionId: id, status: 'terminated' });
    }

    return true;
  }, BACKGROUND_CONTEXT);

  if (!retiring) {
    return true;
  }

  await abortRetiredFocus(engine.harness);
  await engine.harness.commit(async (transaction) => {
    const owner = await transaction.doc(Origins, id, null);
    owner.state = 'stopped';
  }, BACKGROUND_CONTEXT);
  engine.options.wake();

  return true;
}

export async function receiveDelegationDelete(
  engine: ManagedAgentEngine,
  scope: ManagedAgentScope,
  origin: ManagedDelegationOrigin,
): Promise<boolean> {
  await receiveDelegationStop(engine, scope, origin);
  await engine.options.sealErasure(origin.threadId);

  return true;
}

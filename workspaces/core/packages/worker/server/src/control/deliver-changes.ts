import type { ControlChange, ControlStore } from '@mechane/control-store';
import { ServiceUnavailable } from '@mechane/protocol';
import type { MechActorResolver } from '@mechane/runtime';
import { Effect } from 'effect';

const CLAIM_LEASE_MILLISECONDS = 60_000;
const DELIVERY_TIMEOUT_MILLISECONDS = 5000;
const DELIVERY_CONCURRENCY = 4;

export const CONFIGURATION_UNCONFIRMED_REASON =
  'The configuration was saved, but its runtime refresh is unconfirmed. Read its current state before repeating the command.';

type DeliveryInput = {
  readonly store: ControlStore;
  readonly actors: MechActorResolver;
  readonly maxRows: number;
  readonly maxMs: number;
};

type DeliveryDeadlineInput = { readonly deliver: () => Promise<void>; readonly timeoutMilliseconds: number };
type RecipientDeliveryInput = Pick<DeliveryInput, 'store' | 'actors'> & { readonly change: ControlChange };

type ConfirmChangesInput = Pick<DeliveryInput, 'store' | 'actors' | 'maxMs'> & {
  readonly changes: ReadonlyArray<ControlChange>;
};

type ConfirmRecipientInput = RecipientDeliveryInput & { readonly deadlineMilliseconds: number };

async function withDeliveryDeadline({ deliver, timeoutMilliseconds }: DeliveryDeadlineInput): Promise<void> {
  const timer: { handle?: ReturnType<typeof setTimeout> } = {};

  const timeout = new Promise<never>((_resolve, reject) => {
    timer.handle = setTimeout(() => reject(new Error('Control delivery timed out')), timeoutMilliseconds);
  });

  try {
    await Promise.race([deliver(), timeout]);
  } finally {
    clearTimeout(timer.handle);
  }
}

export async function deliverControlChanges({ store, actors, maxRows, maxMs }: DeliveryInput): Promise<void> {
  const claimId = crypto.randomUUID();
  const deadlineMilliseconds = performance.now() + maxMs;
  const changes = await store.claimControlChanges({ claimId, maxRows, leaseMilliseconds: CLAIM_LEASE_MILLISECONDS });

  for (const change of changes) {
    const remainingMilliseconds = deadlineMilliseconds - performance.now();

    if (remainingMilliseconds <= 0) {
      return;
    }

    try {
      await withDeliveryDeadline({
        timeoutMilliseconds: Math.min(DELIVERY_TIMEOUT_MILLISECONDS, remainingMilliseconds),
        deliver: async () => await deliverRecipientChange({ store, actors, change }),
      });
    } catch {
      await store.failControlChange({ id: change.id, claimId, reason: 'delivery_failed' });
    }
  }
}

/** Only this operation's committed rows gate its acknowledgment; unrelated pending changes stay with the sweep. */
export async function confirmControlChanges({ store, actors, changes, maxMs }: ConfirmChangesInput): Promise<void> {
  const deadlineMilliseconds = performance.now() + maxMs;

  const confirmations = await Effect.runPromise(
    Effect.forEach(
      changes,
      (change) =>
        Effect.tryPromise({
          try: () => confirmRecipient({ store, actors, change, deadlineMilliseconds }),
          catch: () => new ServiceUnavailable({ reason: CONFIGURATION_UNCONFIRMED_REASON }),
        }).pipe(Effect.catchTags({ ServiceUnavailable: () => Effect.succeed(false) })),
      { concurrency: DELIVERY_CONCURRENCY },
    ),
  );

  if (confirmations.some((confirmed) => !confirmed)) {
    throw new ServiceUnavailable({ reason: CONFIGURATION_UNCONFIRMED_REASON });
  }
}

async function confirmRecipient({ deadlineMilliseconds, ...input }: ConfirmRecipientInput): Promise<boolean> {
  const remainingMilliseconds = deadlineMilliseconds - performance.now();

  if (remainingMilliseconds <= 0) {
    return false;
  }

  await withDeliveryDeadline({
    timeoutMilliseconds: Math.min(DELIVERY_TIMEOUT_MILLISECONDS, remainingMilliseconds),
    deliver: async () => await deliverRecipientChange(input),
  });

  return true;
}

async function deliverRecipientChange({ store, actors, change }: RecipientDeliveryInput): Promise<void> {
  const identity = { id: change.id, payloadDigest: change.payloadDigest };
  const delivery = await store.readControlChangeDelivery(identity);

  if (delivery === null) {
    throw new Error('The committed control change is unavailable');
  }

  if (delivery.isDelivered) {
    return;
  }

  const recipientChange = delivery.change;

  await actors(recipientChange).applyControlChange({
    id: recipientChange.id,
    sourceSequence: recipientChange.sourceSequence,
    kind: recipientChange.kind,
    revision: recipientChange.definitionRevision,
    payloadDigest: recipientChange.payloadDigest,
  });

  if (!(await store.acknowledgeControlChangeDelivery(identity))) {
    throw new Error('The runtime acknowledged a control change that could not be confirmed');
  }
}

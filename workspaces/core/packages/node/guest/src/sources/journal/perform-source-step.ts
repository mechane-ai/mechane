import { SourceGuestAnswer, SourceStep } from '@mechane/sandbox-wire';
import { Effect, MutableRef } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { readSourceChanges } from '../capture/read-source-changes.ts';
import { activateSource } from '../checkout/activate-source.ts';
import { cloneSourceLease } from '../checkout/clone-source-lease.ts';
import type { SourceStepInput } from '../types.ts';

/** Dispatches only the operations permitted inside an already admitted source generation. */
export const performSourceStep = Effect.fn('performSourceStep')(function* ({
  ...input
}: SourceStepInput): Effect.fn.Return<SourceGuestAnswer, SourceGuestFailed> {
  switch (input.step) {
    case SourceStep.Prepare:
    case SourceStep.PrepareCapture:
    case SourceStep.Release:
      return SourceGuestAnswer.cases.Ready.make({});
    case SourceStep.Activate:
      return yield* activateSourceLease(input);
    case SourceStep.Changes:
      return yield* readSourceChanges(input);
    case SourceStep.Clone:
      return yield* cloneSourceLease(input);
  }
});

/** A retry observes completed activation instead of moving the staging directory a second time. */
const activateSourceLease = Effect.fn('activateSourceLease')(function* ({
  sourceId,
  generation,
  settings,
  lease,
}: SourceStepInput): Effect.fn.Return<SourceGuestAnswer, SourceGuestFailed> {
  const progress = MutableRef.get(lease.progress);

  if (!progress.isCloned) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source clone has not completed' });
  }

  if (!progress.isActivated) {
    yield* activateSource({ sourceId, generation, settings });
    MutableRef.update(lease.progress, (current) => ({ ...current, isActivated: true }));
  }

  return SourceGuestAnswer.cases.Ready.make({});
});

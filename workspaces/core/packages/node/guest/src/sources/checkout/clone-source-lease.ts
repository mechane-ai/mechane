import { SourceClone, SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Effect, MutableRef, Schema } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { readSourceBody } from '../journal/read-source-body.ts';
import type { SourceStepInput } from '../types.ts';
import { completeSourceClone } from './complete-source-clone.ts';
import { requireSourceGuest } from './require-source-guest.ts';

/** The credential-bearing request is decoded only inside its admitted generation. */
const SourceCloneBody = Schema.fromJsonString(SourceClone);

type ReadSourceCloneInput = Pick<SourceStepInput, 'sourceId' | 'generation' | 'settings'> & { readonly body: string };

/** Records in-flight and completed clone progress so polling cannot start a second fetch. */
export const cloneSourceLease = Effect.fn('cloneSourceLease')(function* ({
  ...input
}: SourceStepInput): Effect.fn.Return<SourceGuestAnswer, SourceGuestFailed> {
  const { sourceId, generation, settings, lease } = input;
  const body = yield* readSourceBody(input);
  const progress = MutableRef.get(lease.progress);

  if (progress.isCloning) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  if (progress.isCloned) {
    return SourceGuestAnswer.cases.Ready.make({});
  }

  const clone = yield* readSourceClone({ sourceId, generation, body, settings });

  MutableRef.update(lease.progress, (current) => ({ ...current, isCloning: true }));

  const outcome = yield* completeSourceClone({ settings, clone });
  const isCloned = SourceGuestAnswer.guards.Ready(outcome);

  MutableRef.update(lease.progress, (current) => ({ ...current, isCloning: false, isCloned }));

  return outcome;
});

/** Rejects a mismatched identity before any credential enters the Git process. */
const readSourceClone = Effect.fn('readSourceClone')(function* ({
  sourceId,
  generation,
  body,
  settings,
}: ReadSourceCloneInput): Effect.fn.Return<SourceClone, SourceGuestFailed> {
  const clone = yield* Schema.decodeUnknownEffect(SourceCloneBody)(body).pipe(
    Effect.mapError(() => new SourceGuestFailed({ sourceId, reason: 'source clone request is invalid' })),
  );

  if (clone.sourceId !== sourceId || clone.generation !== generation) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source clone identity differs' });
  }

  yield* requireSourceGuest({
    sourceId,
    repositoryUrl: clone.repositoryUrl,
    scope: settings.scope,
    reason: 'private source credentials cannot enter a previously used guest',
  });

  return clone;
});

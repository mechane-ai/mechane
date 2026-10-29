import { SourceStep } from '@mechane/sandbox-wire';
import { Effect, MutableRef, Option } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { quiesceWorkspace } from '../../quiescence/quiesce-workspace.ts';
import { prepareSourceGuest } from '../checkout/prepare-source-guest.ts';
import type { SourceLease, SourceProgress } from '../types.ts';
import type { SourceAdmissionInput } from './types.ts';

/** Only preparation requests may establish a generation's initial guest fence. */
const PREPARATION_STEPS: ReadonlySet<SourceStep> = new Set([SourceStep.Prepare, SourceStep.PrepareCapture]);

/** Admits one generation after command and process quiescence, or reports pending while a command still runs. */
export const prepareSourceLease = Effect.fn('prepareSourceLease')(function* ({
  settings,
  ledger,
  state,
  ...request
}: SourceAdmissionInput): Effect.fn.Return<Option.Option<SourceLease>, SourceGuestFailed> {
  const { sourceId, generation, step } = request;
  const known = yield* readKnownSourceLease({ ...request, settings, state });

  if (Option.isSome(known)) {
    return known;
  }

  if (!PREPARATION_STEPS.has(step)) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source generation has no guest fence' });
  }

  if (!ledger.quiesce()) {
    return Option.none();
  }

  yield* quiesceWorkspace({ folder: settings.home, settings, generation }).pipe(
    Effect.mapError(() => new SourceGuestFailed({ sourceId, reason: 'source guest did not quiesce' })),
  );

  const progress = MutableRef.make<SourceProgress>({ isCloning: false, isCloned: false, isActivated: false });
  const lease = Option.some({ sourceId, generation, progress });

  MutableRef.set(state, lease);

  return lease;
});

/** A preparation retry is revalidated, and no request can borrow another generation's admitted fence. */
const readKnownSourceLease = Effect.fn('readKnownSourceLease')(function* ({
  settings,
  state,
  ...request
}: Omit<SourceAdmissionInput, 'ledger'>): Effect.fn.Return<Option.Option<SourceLease>, SourceGuestFailed> {
  const { sourceId, generation, step } = request;
  const known = MutableRef.get(state);

  if (Option.isSome(known) && (known.value.sourceId !== sourceId || known.value.generation !== generation)) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'another source generation owns the guest fence' });
  }

  if (step === SourceStep.Prepare) {
    yield* prepareSourceGuest({ ...request, settings });
  }

  return known;
});

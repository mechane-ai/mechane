import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { SourceGuestAnswer, SourceStep } from '@mechane/sandbox-wire';
import { Effect, MutableRef, Option, Schema } from 'effect';
import { SourceGuestFailed } from '../../errors.ts';
import { quiesceWorkspace } from '../../quiescence/quiesce-workspace.ts';
import type { ServedAnswer } from '../../types.ts';
import { performSourceStep } from './perform-source-step.ts';
import { prepareSourceLease } from './prepare-source-lease.ts';
import type { SourceAdmissionInput } from './types.ts';

/** The source response as JSON, encoded once at the guest HTTP boundary. */
const SourceAnswerBody = Schema.fromJsonString(SourceGuestAnswer);

type SourceResponseInput = { readonly outcome: SourceGuestAnswer };

/** Holds commands outside the source generation until its final quiescence and explicit release complete. */
export const answerSource = Effect.fn('answerSource')(function* ({
  settings,
  ledger,
  state,
  ...request
}: SourceAdmissionInput): Effect.fn.Return<ServedAnswer, SourceGuestFailed> {
  const { sourceId, generation, step } = request;
  const lease = yield* prepareSourceLease({ ...request, settings, ledger, state });

  if (Option.isNone(lease)) {
    const pending = SourceGuestAnswer.cases.Pending.make({});

    return sourceResponse({ outcome: pending });
  }

  if (step === SourceStep.Release) {
    yield* quiesceWorkspace({ folder: settings.home, settings, generation }).pipe(
      Effect.mapError(() => new SourceGuestFailed({ sourceId, reason: 'source guest did not quiesce before release' })),
    );
  }

  const outcome = yield* performSourceStep({ ...request, settings, lease: lease.value });

  if (step === SourceStep.Release) {
    const released = Option.none();

    MutableRef.set(state, released);
    ledger.resume();
  }

  return sourceResponse({ outcome });
});

/** Every source result uses the same content type and structured answer envelope. */
function sourceResponse({ outcome }: SourceResponseInput): ServedAnswer {
  const body = Schema.encodeSync(SourceAnswerBody)(outcome);

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Json }, body };
}

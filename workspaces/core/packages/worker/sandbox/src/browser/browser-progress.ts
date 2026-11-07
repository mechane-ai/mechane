import type { BrowserCall } from '@mechane/sandbox-store';
import { BrowserProgress, BrowserRequest } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';

type BrowserProgressInput = { readonly call: BrowserCall };

class BrowserCallIncomplete extends Schema.TaggedError<BrowserCallIncomplete>()('BrowserCallIncomplete', {
  requestId: BrowserRequest.fields.requestId,
}) {}

/** None means the durable call has neither an actual receipt nor a terminal failure yet. */
export function browserProgress({ call }: BrowserProgressInput): Option.Option<BrowserProgress> {
  if (Option.isSome(call.response)) {
    if (Option.isNone(call.machineId)) {
      const cause = new BrowserCallIncomplete({ requestId: call.request.requestId });
      const failed = Result.fail(cause);

      return Result.getOrThrow(failed);
    }

    const machineId = call.machineId.value;
    const ready = BrowserProgress.cases.Ready.make({ machineId, response: call.response.value });

    return Option.some(ready);
  }

  if (Option.isNone(call.failure)) {
    return Option.none();
  }

  const { reason, isUncertain } = call.failure.value;

  if (isUncertain) {
    const uncertain = BrowserProgress.cases.Uncertain.make({ reason });

    return Option.some(uncertain);
  }

  const failed = BrowserProgress.cases.Failed.make({ reason });

  return Option.some(failed);
}

/** Requires the receipt or terminal failure that a completed dispatch must have persisted. */
export function completedBrowserProgress({ call }: BrowserProgressInput): BrowserProgress {
  const progress = browserProgress({ call });

  if (Option.isNone(progress)) {
    const cause = new BrowserCallIncomplete({ requestId: call.request.requestId });
    const failed = Result.fail(cause);

    return Result.getOrThrow(failed);
  }

  return progress.value;
}

import type { MechTables, SourceTask } from '@mechane/mech-store';
import { SourceStatus } from '@mechane/protocol';
import { SourceFenceReport } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { saveSourceFence } from './save-source-fence.ts';
import type { SourceCheckoutContext } from './types.ts';

type SourceCheckoutFinish = SourceCheckoutContext & {
  /** Absent when the sandbox report supplies the only diagnostic. */
  readonly reason: Option.Option<string>;
};

/** Only the sandbox's durable completion can make a checkout ready. */
export async function finishSourceCheckout({
  mech,
  owner,
  source,
  sandbox,
  checkout,
  reason,
}: SourceCheckoutFinish): Promise<SourceTask> {
  const promise = sandbox.finishSource(checkout);
  const response = await capturePromise({ promise });

  if (Result.isFailure(response)) {
    return await recordSourceUncertainty({ mech, source });
  }

  const decoded = Schema.decodeUnknownResult(SourceFenceReport)(response.success);

  if (Result.isFailure(decoded)) {
    return await recordSourceUncertainty({ mech, source });
  }

  const fallback: () => Option.Option<string> = () => decoded.success.reason;
  const fence = { ...decoded.success, reason: Option.orElse(reason, fallback) };

  return await saveSourceFence({ mech, owner, sandbox, source, fence });
}

type RecordSourceUncertaintyInput = Pick<SourceCheckoutFinish, 'mech' | 'source'>;

async function recordSourceUncertainty({ mech, source }: RecordSourceUncertaintyInput): Promise<SourceTask> {
  const next = {
    ...source,
    status: SourceStatus.Fenced,
    reason: Option.some('source checkpoint status is unavailable; retry preserves its fence'),
  };

  const run: (store: MechTables) => void = (store) => store.saveSourceTask({ source: next });

  await mech.store.atomic({ run });

  return next;
}

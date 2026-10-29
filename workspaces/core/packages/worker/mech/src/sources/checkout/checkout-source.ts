import type { SourceTask } from '@mechane/mech-store';
import { SourceStatus } from '@mechane/protocol';
import { SourceCheckout, SourceFencePhase, SourceFenceReport } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { isSourceGranted } from '../context/is-source-granted.ts';
import type { SourceTaskInput } from '../types.ts';
import { cloneSourceCheckout } from './clone-source-checkout.ts';
import { finishSourceCheckout } from './finish-source-checkout.ts';
import { sourceRepositoryUrl } from './source-repository-url.ts';

const TERMINAL_STATUSES: ReadonlySet<SourceStatus> = new Set([SourceStatus.Ready, SourceStatus.Failed]);

/** Restarts the same pinned checkout without exposing a token until preparation is acknowledged. */
export async function checkoutSource({ mech, owner, source, sandbox }: SourceTaskInput): Promise<SourceTask> {
  if (TERMINAL_STATUSES.has(source.status)) {
    return source;
  }

  const repositoryUrl = sourceRepositoryUrl({ origin: mech.settings.githubWebOrigin, grant: source.grant });
  const checkout = { sourceId: source.sourceId, generation: source.generation, repositoryUrl, commit: source.commit };
  const context = { mech, owner, source, sandbox, checkout };
  const reason = Option.none<string>();
  const encoded = Schema.encodeSync(SourceCheckout)(checkout);
  const promise = sandbox.prepareSource({ checkout: encoded });
  const response = await capturePromise({ promise });

  if (Result.isFailure(response)) {
    return await finishSourceCheckout({ ...context, reason });
  }

  const prepared = Schema.decodeUnknownResult(SourceFenceReport)(response.success);

  if (Result.isFailure(prepared) || prepared.success.phase !== SourceFencePhase.Prepared) {
    return await finishSourceCheckout({ ...context, reason });
  }

  const isGranted = await isSourceGranted({ mech, owner, source, sandbox });

  if (!isGranted) {
    await sandbox.revokeSource(checkout);

    const refusal = Option.some('the repository grant changed before checkout');

    return await finishSourceCheckout({ ...context, reason: refusal });
  }

  return await cloneSourceCheckout(context);
}

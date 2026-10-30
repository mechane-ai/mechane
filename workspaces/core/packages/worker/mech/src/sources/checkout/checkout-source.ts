import type { SourceTask } from '@mechane/mech-store';
import { SourceStatus } from '@mechane/protocol';
import { SourceAnswer } from '@mechane/rpc';
import { SourceCheckout, SourceFencePhase, SourceFenceReport } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { admitSourceMachine } from '../configuration/admit-source-machine.ts';
import { isSourceGranted } from '../context/is-source-granted.ts';
import { sourceAnswer } from '../context/source-answer.ts';
import type { SourceTaskInput } from '../types.ts';
import { cloneSourceCheckout } from './clone-source-checkout.ts';
import { finishSourceCheckout } from './finish-source-checkout.ts';
import { sourceRepositoryUrl } from './source-repository-url.ts';

const TERMINAL_STATUSES: ReadonlySet<SourceStatus> = new Set([SourceStatus.Ready, SourceStatus.Failed]);

/** Restarts the same pinned checkout without exposing a token until preparation is acknowledged. */
export async function checkoutSource({ mech, owner, source, sandbox }: SourceTaskInput): Promise<SourceAnswer> {
  if (TERMINAL_STATUSES.has(source.status)) {
    return sourceAnswer({ source });
  }

  const context = { mech, owner, source, sandbox };
  const isGranted = await isSourceGranted(context);

  if (!isGranted) {
    return SourceAnswer.cases.Refused.make({ reason: 'the repository grant changed before checkout' });
  }

  const refusal = await admitSourceMachine(context);

  if (Option.isSome(refusal)) {
    return SourceAnswer.cases.Refused.make({ reason: refusal.value });
  }

  const next = await prepareCheckout(context);

  return sourceAnswer({ source: next });
}

async function prepareCheckout({ mech, owner, source, sandbox }: SourceTaskInput): Promise<SourceTask> {
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

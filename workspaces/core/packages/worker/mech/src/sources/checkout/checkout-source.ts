import type { SourceTask } from '@mechane/mech-store';
import { SourceStatus } from '@mechane/protocol';
import { MachineRefusal, SandboxSourceAnswer, SourceAnswer } from '@mechane/rpc';
import { SourceCheckout, SourceFencePhase } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Match, Option, Result, Schema } from 'effect';
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

  const next = await prepareCheckout(context);

  if (Schema.is(MachineRefusal)(next)) {
    const reason = Match.valueTags(next, {
      Disabled: () => 'source sandbox is disabled for this workspace',
      CapacityReached: () => 'workspace sandbox machine capacity is full',
    });

    return SourceAnswer.cases.Refused.make({ reason });
  }

  return sourceAnswer({ source: next });
}

async function prepareCheckout({
  mech,
  owner,
  source,
  sandbox,
}: SourceTaskInput): Promise<SourceTask | MachineRefusal> {
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

  const prepared = Schema.decodeUnknownResult(SandboxSourceAnswer)(response.success);

  if (Result.isSuccess(prepared) && Schema.is(MachineRefusal)(prepared.success)) {
    return prepared.success;
  }

  if (
    Result.isFailure(prepared) ||
    !('phase' in prepared.success) ||
    prepared.success.phase !== SourceFencePhase.Prepared
  ) {
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

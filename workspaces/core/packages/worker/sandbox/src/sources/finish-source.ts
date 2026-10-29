import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Result } from 'effect';
import { expireSourceCredential } from './finalization/expire-source-credential.ts';
import { finalizeSource } from './finalization/finalize-source.ts';
import { releaseSource } from './finalization/release-source.ts';
import { findSourceFence } from './find-source-fence.ts';
import { expirePreparation } from './preparation/expire-preparation.ts';
import { sourceReport } from './source-report.ts';
import type { SourceFenceInput, SourceFinalizeInput } from './types.ts';

type AdvanceSourceFenceInput = SourceFinalizeInput & Pick<SourceFenceInput, 'generation'>;

const PREPARATION_PHASES: ReadonlySet<SourceFencePhase> = new Set([
  SourceFencePhase.Preparing,
  SourceFencePhase.Prepared,
]);

/** Releases only the matching source generation, preserving exposed credentials until revocation or expiry. */
export async function finishSource({
  store,
  provider,
  workspace,
  sourceId,
  generation,
}: SourceFenceInput): Promise<SourceFenceReport> {
  const saved = findSourceFence({ store, sourceId, generation });

  return await Result.match(saved, {
    onFailure: (report) => report,
    onSuccess: (fence) => advanceSourceFence({ store, provider, workspace, fence, generation }),
  });
}

async function advanceSourceFence({
  store,
  provider,
  workspace,
  fence,
  generation,
}: AdvanceSourceFenceInput): Promise<SourceFenceReport> {
  if (fence.generation !== generation) {
    return sourceReport({ fence });
  }

  const input = { store, provider, workspace, fence };

  if (PREPARATION_PHASES.has(fence.phase)) {
    return await expirePreparation(input);
  }

  if (fence.phase === SourceFencePhase.Exposed) {
    return expireSourceCredential(input);
  }

  if (fence.phase === SourceFencePhase.Revoked) {
    return await releaseSource(input);
  }

  if (fence.phase === SourceFencePhase.Finalizing) {
    return await finalizeSource(input);
  }

  return sourceReport({ fence });
}

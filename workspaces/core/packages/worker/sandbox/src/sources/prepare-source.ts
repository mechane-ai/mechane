import type { SourceFence } from '@mechane/sandbox-store';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceCheckout, SourceFenceReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { matchesSourceCheckout } from './matches-source-checkout.ts';
import { initialSourceFence } from './preparation/initial-source-fence.ts';
import { requestSourcePreparation } from './preparation/request-source-preparation.ts';
import { sourceReport } from './source-report.ts';

type PrepareSourceInput = WorkspaceProviderStepInput & { readonly checkout: SourceCheckout };

/** A source identity keeps its checkout and initial deadline across every preparation retry. */
export async function prepareSource({
  store,
  provider,
  workspace,
  checkout,
}: PrepareSourceInput): Promise<SourceFenceReport> {
  const existing = store.sourceFence({ sourceId: checkout.sourceId });
  const create: () => SourceFence = () => initialSourceFence({ checkout });
  const fence = Option.getOrElse(existing, create);
  const active = store.activeSourceFence();

  if (Option.isSome(active) && active.value.sourceId !== checkout.sourceId) {
    return {
      ...sourceReport({ fence }),
      phase: SourceFencePhase.Failed,
      reason: Option.some('another source checkout owns the sandbox fence'),
    };
  }

  if (!matchesSourceCheckout({ fence, checkout })) {
    return { ...sourceReport({ fence }), reason: Option.some('source identity already names another checkout') };
  }

  if (fence.phase !== SourceFencePhase.Preparing) {
    return sourceReport({ fence });
  }

  store.saveSourceFence({ fence });

  return await requestSourcePreparation({ store, provider, workspace, fence });
}

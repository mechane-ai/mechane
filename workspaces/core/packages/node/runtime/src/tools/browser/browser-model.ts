import { loadRuntimeConfiguration } from '../../config.ts';
import type { RuntimeStore } from '../../store/database.ts';
import type { RuntimeToolContext } from '../types.ts';

type BrowserModelInput = RuntimeToolContext & { readonly store: RuntimeStore };

/** Image admission follows the consuming run's pinned model revision, including status reads from later runs. */
export async function hasBrowserImageInput({ store, runId, workspaceId, mechId }: BrowserModelInput): Promise<boolean> {
  const run = await store.getRun({ runId, workspaceId });

  if (run === null || run.mechId !== mechId) {
    return false;
  }

  const revision = await store.getMechRevision({ workspaceId, mechId, revision: run.definitionRevision });

  if (revision === null) {
    return false;
  }

  const configuration = loadRuntimeConfiguration();
  const offer = configuration.model.offers.find((candidate) => candidate.id === revision.model);

  return offer?.supportsImages === true;
}

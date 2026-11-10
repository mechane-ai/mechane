import type { ControlStore } from '@mechane/control-store';
import {
  MECH_HISTORY_IMPORT_BODY_MAX_BYTES,
  MECH_HISTORY_IMPORT_PATH,
  MechHistoryImport,
  MechHistoryImportReceipt,
  RequestInvalid,
} from '@mechane/protocol';
import type { MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createInternalPostHandler } from './internal-post.ts';

type ImportHandlerInput = {
  readonly store: ControlStore;
  readonly actors: MechActorResolver;
  readonly configuration: RuntimeConfiguration;
};

export function createMechImportHandler({ store, actors, configuration }: ImportHandlerInput) {
  return createInternalPostHandler({
    pathname: MECH_HISTORY_IMPORT_PATH,
    bearer: configuration.sandbox.bearer,
    maximumBytes: MECH_HISTORY_IMPORT_BODY_MAX_BYTES,
    respond: async (body) => {
      const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(MechHistoryImport), {
        onExcessProperty: 'error',
      })(body);

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The historical mech import is invalid' });
      }

      const { workspaceId, mechId, ...batch } = decoded.success;

      const mech = await store.getMech({ workspaceId, mechId });
      const policy = await store.showWorkspacePolicy(workspaceId);
      const actor = actors({ workspaceId, mechId });
      const status = await actor.readMech();
      const isPolicyInactive = policy.isSuspended || mech.status !== 'active';

      if (!isPolicyInactive && status.status !== 'quiesced') {
        throw new RequestInvalid({
          reason: 'Historical import requires a suspended workspace, inactive mech, or quiesced actor',
        });
      }

      const receipt = await actor.importHistory(batch);

      return Schema.encodeSync(MechHistoryImportReceipt)(receipt);
    },
  });
}

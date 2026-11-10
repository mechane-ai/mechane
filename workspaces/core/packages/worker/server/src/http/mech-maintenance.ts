import type { ControlStore } from '@mechane/control-store';
import {
  MECH_MAINTENANCE_PATH,
  MechMaintenanceReceipt,
  MechMaintenanceRequest,
  RequestInvalid,
} from '@mechane/protocol';
import type { MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createInternalPostHandler } from './internal-post.ts';

const MAINTENANCE_BODY_MAX_BYTES = 4096;

type MechMaintenanceHandlerInput = {
  readonly store: ControlStore;
  readonly actors: MechActorResolver;
  readonly configuration: RuntimeConfiguration;
};

export function createMechMaintenanceHandler({ store, actors, configuration }: MechMaintenanceHandlerInput) {
  return createInternalPostHandler({
    pathname: MECH_MAINTENANCE_PATH,
    bearer: configuration.sandbox.bearer,
    maximumBytes: MAINTENANCE_BODY_MAX_BYTES,
    respond: async (body) => {
      const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(MechMaintenanceRequest), {
        onExcessProperty: 'error',
      })(body);

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The mech maintenance request is invalid' });
      }

      const { action, workspaceId, mechId } = decoded.success;

      await store.getMech({ workspaceId, mechId });

      const receipt = await actors({ workspaceId, mechId }).maintenance({ action });

      const output = Schema.decodeUnknownSync(MechMaintenanceReceipt)(receipt);

      return Schema.encodeSync(MechMaintenanceReceipt)(output);
    },
  });
}

import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createSession } from '@earendil-works/pi-durable';
import { openDurableObjectSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/cloudflare';
import { openControlStore, StoreConflict } from '@mechane/control-store';
import type { ControlStore } from '@mechane/control-store';
import { RequestConflict, RequestInvalid, ServerFailure, ServiceUnavailable } from '@mechane/protocol';
import { HttpStatusCode, MechId, WorkspaceId } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { loadRuntimeConfiguration, resolveRuntimeEnvironment } from '../config.ts';
import { writeActorOperationFailure } from '../output/write-actor-diagnostic.ts';
import { archiveOperation } from './archive-operations.ts';
import { ownsActorAddress } from './identity.ts';
import { State } from './state.ts';
import type { RuntimeBindings } from './types.ts';

const Envelope = Schema.Struct({
  workspaceId: WorkspaceId,
  mechId: MechId,
  method: Schema.NonEmptyString,
  input: Schema.Record(Schema.String, Schema.Unknown),
});

function failureResponse(failure: typeof ServerFailure.Type, status: number) {
  return Response.json({ failure: Schema.encodeSync(ServerFailure)(failure) }, { status });
}

export async function serveArchive(actor: DurableObjectState, environment: RuntimeBindings, request: Request) {
  async function configuration() {
    return loadRuntimeConfiguration({ environment: await resolveRuntimeEnvironment({ environment }) });
  }

  async function withControl<T>(operation: (store: ControlStore) => Promise<T>) {
    const settings = await configuration();

    const store = await openControlStore({
      databaseUrl: Redacted.value(settings.databaseUrl),
      keyring: Redacted.value(settings.credentialKeyring),
      maxConnections: settings.maxConnections,
    });

    try {
      return await operation(store);
    } finally {
      await store.close();
    }
  }

  try {
    const { workspaceId, mechId, method, input } = Schema.decodeUnknownSync(Envelope)(await request.json());
    const scope = { workspaceId, mechId };

    if (!ownsActorAddress({ state: actor, bindings: environment, name: mechId })) {
      throw new RequestInvalid({ reason: 'The archive address differs from its mech' });
    }

    const records = await openDurableObjectSqliteStorage(actor.storage);
    const session = createSession(records);

    try {
      const state = await session.snapshot(State, BACKGROUND_CONTEXT);

      if (state === undefined || state.scope === null) {
        await withControl((store) => store.getMech(scope));
      } else if (state.scope.workspaceId !== workspaceId || state.scope.mechId !== mechId) {
        throw new RequestInvalid({ reason: 'The archive belongs to another workspace or mech' });
      }

      const archive = { scope, state, session, records, storage: actor.storage, configuration, withControl };
      const result = await archiveOperation(archive, method, input);

      return Response.json(result ?? null);
    } finally {
      await session.close(BACKGROUND_CONTEXT);
    }
  } catch (failure) {
    if (failure instanceof StoreConflict) {
      return failureResponse(new RequestConflict({ reason: failure.message }), HttpStatusCode.Conflict);
    }

    if (failure instanceof RequestConflict) {
      return failureResponse(failure, HttpStatusCode.Conflict);
    }

    if (Schema.is(ServerFailure)(failure)) {
      return failureResponse(failure, HttpStatusCode.BadRequest);
    }

    writeActorOperationFailure(failure);

    return failureResponse(
      new ServiceUnavailable({ reason: 'The archived mech operation could not finish' }),
      HttpStatusCode.Unavailable,
    );
  }
}

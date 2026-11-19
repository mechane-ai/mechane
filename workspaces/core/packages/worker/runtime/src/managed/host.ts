import { openControlStore } from '@mechane/control-store';
import type { ControlStore } from '@mechane/control-store';
import { HttpStatusCode } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { ownsActorAddress } from '../actor/identity.ts';
import { fingerprint } from '../actor/state.ts';
import type { InstalledWorkerScheduler, RuntimeBindings } from '../actor/types.ts';
import { loadRuntimeConfiguration, resolveRuntimeEnvironment } from '../config.ts';
import { writeActorOperationFailure } from '../output/write-actor-diagnostic.ts';
import { createManagedAgentRuntime } from './client.ts';
import { startManagedSessionEngine } from './engine.ts';
import { failManagedRequest, ManagedRuntimeError, ManagedRuntimeFailureWire } from './failure.ts';
import { createManagedIdentitySlots } from './identity-slot.ts';
import { managedActorName } from './identity.ts';
import { runManagedOperation } from './operations.ts';
import { ManagedAgentScope } from './protocol.ts';
import type { ManagedSessionMutation } from './protocol.ts';
import { runManagedReadOperation } from './read-operations.ts';
import { openManagedSessionPool } from './session-pool.ts';
import { openManagedSessionReader } from './session-reader.ts';
import { managedSessionRoute } from './session-route.ts';
import { openManagedSessionIndex, sessionMissing } from './store/session-index.ts';
import { createManagedSessionStorage } from './store/session-storage.ts';

const internalFailureMessage = 'The managed agent operation could not finish';

const ManagedEnvelope = Schema.Struct({
  scope: ManagedAgentScope,
  method: Schema.NonEmptyString,
  input: Schema.Unknown,
});

export function openManagedHost(
  state: DurableObjectState,
  bindings: RuntimeBindings,
  scheduleInstalled: InstalledWorkerScheduler,
) {
  const index = openManagedSessionIndex(state.storage);
  const stores = createManagedSessionStorage(state.storage);
  const slots = createManagedIdentitySlots(state.storage);
  const poolState: { opening?: ReturnType<typeof start> } = {};

  function scopedDelegate(scope: ManagedAgentScope) {
    return function delegate(agentId: string) {
      const target = { workspaceId: scope.workspaceId, agentId };

      if (agentId === scope.agentId) {
        return createManagedAgentRuntime({ getByName: () => ({ fetch }) }, target);
      }

      return createManagedAgentRuntime(bindings.MECHS, target);
    };
  }

  async function start(scope: ManagedAgentScope) {
    await slots.recover();

    const environment = await resolveRuntimeEnvironment({ environment: bindings });
    const configuration = loadRuntimeConfiguration({ environment });

    async function withControl<T>(operation: (store: ControlStore) => Promise<T>): Promise<T> {
      const store = await openControlStore({
        databaseUrl: Redacted.value(configuration.databaseUrl),
        keyring: Redacted.value(configuration.credentialKeyring),
        maxConnections: configuration.maxConnections,
      });

      try {
        return await operation(store);
      } finally {
        await store.close();
      }
    }

    const wakeInstalledSession = scheduleInstalled({ configuration, actors: bindings.MECHS, execution: state });

    return openManagedSessionPool({
      index,
      waitUntil: (pending) => state.waitUntil(pending),
      openReader: async (id) =>
        openManagedSessionReader({ storage: await stores.open(id), workspaceId: scope.workspaceId, withControl }),
      erase: async (id) => {
        await slots.remove(id);
        await stores.erase(id);
      },
      start: async ({ id, wake }) => {
        const options = {
          storage: await stores.open(id),
          scope,
          configuration,
          withControl,
          wakeInstalledSession,
          waitUntil: (pending: Promise<void>) => state.waitUntil(pending),
          wake,
          identitySlot: slots.forSession(id),
          sealErasure: async (target: string, mutation?: ManagedSessionMutation) => {
            if (target !== id) {
              throw new Error('Managed session erasure crossed an execution boundary');
            }

            if (mutation === undefined) {
              await index.seal(id, null);

              return;
            }

            await index.seal(id, await fingerprint(mutation));
          },
          delegate: scopedDelegate(scope),
        };

        return await startManagedSessionEngine(options);
      },
    });
  }

  async function pool(scope: ManagedAgentScope) {
    poolState.opening ??= start(scope).catch((failure: unknown) => {
      delete poolState.opening;

      throw failure;
    });

    return await poolState.opening;
  }

  async function fetch(request: Request): Promise<Response> {
    try {
      const decoded = Schema.decodeUnknownResult(ManagedEnvelope)(await request.json());

      if (decoded._tag === 'Failure') {
        return failManagedRequest(HttpStatusCode.BadRequest, 'Invalid managed agent operation');
      }

      const { scope, method, input } = decoded.success;

      if (!ownsActorAddress({ state, bindings, name: managedActorName(scope) })) {
        return sessionMissing();
      }

      const existing = await index.savedScope();

      if (method === 'attention') {
        if (existing === undefined) {
          return Response.json({ sessionId: null, queuedSessionIds: [] });
        }

        await pool(scope);

        return Response.json(await index.attention(await slots.attention()));
      }

      const route = await managedSessionRoute(scope, method, input);

      if (existing === undefined) {
        if (!route.canCreate) {
          return sessionMissing();
        }

        await index.rememberScope(scope);
      }

      const sessions = await pool(scope);

      return await sessions.run(route, request.signal, {
        read: (view) => runManagedReadOperation({ scope, method, input, delegate: scopedDelegate(scope), ...view }),
        write: (engine) => runManagedOperation({ scope, method, input, engine }),
      });
    } catch (failure) {
      if (failure instanceof ManagedRuntimeError) {
        return Response.json(Schema.encodeSync(ManagedRuntimeFailureWire)(failure), { status: failure.status });
      }

      writeActorOperationFailure(failure);

      const safe = new ManagedRuntimeError({
        status: HttpStatusCode.InternalServerError,
        reason: internalFailureMessage,
      });

      return Response.json(Schema.encodeSync(ManagedRuntimeFailureWire)(safe), { status: safe.status });
    }
  }

  async function alarm(scope: ManagedAgentScope): Promise<void> {
    const sessions = await pool(scope);

    await sessions.alarm();
  }

  return { fetch, alarm, savedScope: index.savedScope };
}

import { createRegistry, defineExtension, GenerationTask, hook } from '@earendil-works/pi-durable';
import type { Extension, Harness } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import type { WithControl } from '../actor/types.ts';
import type { RuntimeConfiguration } from '../config.ts';
import { coordinatorTools } from './delegation/coordinator.ts';
import type { createExecutionGate } from './execution-gate.ts';
import { waitManagedTool } from './external-tools.ts';
import { executeManagedMcpCall } from './mcp/dispatch.ts';
import { sessionMcpContext, toolDescriptors } from './mcp/registry.ts';
import type { McpProjection } from './mcp/registry.ts';
import { recordManagedRetry } from './model-retries.ts';
import { nativeContentHooks } from './native-compaction.ts';
import { waitForOwner } from './ownership.ts';
import { managedToolExtension } from './pi-tools.ts';
import type { GenerationRegistry } from './preview-output.ts';
import { ManagedWireObject } from './protocol.ts';
import type { ManagedAgentScope } from './protocol.ts';
import { enqueue, release, sessionState, Slot } from './scheduler.ts';
import { preserveManagedSystemMessages } from './system-message.ts';
import type { ManagedToolEvaluator } from './tools/auto-policy.ts';
import { unavailableToolEvents } from './tools/unavailable-tool-events.ts';

type ExtensionOwner = {
  readonly generations: GenerationRegistry;
  readonly configuration: RuntimeConfiguration;
  readonly scope: ManagedAgentScope;
  readonly withControl: WithControl;
  readonly harness: () => Harness;
  readonly identity: ReturnType<typeof createExecutionGate>;
  readonly wake: () => void;
  readonly evaluate: ManagedToolEvaluator;
};

function generationHook(owner: ExtensionOwner, id: string) {
  return hook(GenerationTask, {
    async beforeRequest(_request, api, context) {
      const harness = owner.harness();

      await harness.commit(async (transaction) => {
        await recordManagedRetry(transaction, id, api.taskId);

        const state = await sessionState(transaction, id);

        const suspended = state.interrupt !== null || state.waiting !== null;

        if (state.activeEvent === null || state.isArchived || suspended) {
          throw new Error('The session cannot dispatch a model call');
        }

        if (state.conversation === api.conversationId) {
          owner.generations.mark(context.abortSignal, { sessionId: id, taskId: api.taskId });
        }

        const slot = await transaction.doc(Slot);

        if (slot.owner === id && slot.head !== null) {
          await release(transaction, id);
          await enqueue(transaction, id);
        }
      }, context);
      owner.wake();
      await waitForOwner(harness, id, context);
    },
  });
}

export function createSessionExtensions(owner: ExtensionOwner) {
  const registry = createRegistry();
  const installed = new Map<string, { readonly key: string; readonly extension: Extension }>();

  function mcpContext(projection: McpProjection) {
    return sessionMcpContext(projection, {
      settings: owner.configuration.managedMcp,
      scope: owner.scope,
      withControl: owner.withControl,
    });
  }

  function install(
    session: { readonly id: string; readonly tools: string; readonly coordinator: string },
    projection: McpProjection,
  ): Extension {
    const key = JSON.stringify([session.tools, session.coordinator, projection.mcpServers, projection.mcpDescriptors]);
    const prior = installed.get(session.id);

    if (prior?.key === key) {
      return prior.extension;
    }

    const harness = owner.harness();
    const runtime = mcpContext(projection);
    const tools = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject))(JSON.parse(session.tools));

    const toolset = managedToolExtension({
      sessionId: session.id,
      tools,
      discovered: toolDescriptors(projection),
      web: owner.configuration.managedWeb,
      async dispatch(call, context) {
        const execution = {
          call,
          context,
          harness,
          wake: owner.wake,
          exclusive: owner.identity.run,
          evaluate: owner.evaluate,
        };

        if (call.kind === 'mcp') {
          return await executeManagedMcpCall({ ...execution, runtime, currentEpoch: owner.identity.currentEpoch });
        }

        return await waitManagedTool(execution);
      },
    });

    const delegation = coordinatorTools({
      sessionId: session.id,
      scope: owner.scope,
      roster: session.coordinator,
      harness: owner.harness,
      wake: owner.wake,
      identity: owner.identity.run,
    });

    const extension = defineExtension({
      ...toolset,
      tools: [...(toolset.tools ?? []), ...delegation],
      hooks: [
        ...(toolset.hooks ?? []),
        unavailableToolEvents(harness, session.id),
        preserveManagedSystemMessages,
        ...nativeContentHooks(harness, session.id),
        generationHook(owner, session.id),
      ],
    });

    registry.install(extension);
    installed.set(session.id, { key, extension });

    return extension;
  }

  return { registry, mcpContext, install };
}

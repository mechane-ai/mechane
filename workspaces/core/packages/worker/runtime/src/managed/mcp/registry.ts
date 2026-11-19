import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { WithControl } from '../../actor/types.ts';
import { MCP_MAX_TOOLS, TOOL_REQUEST_TIMEOUT_MS, TOOL_RESPONSE_MAX_BYTES } from '../../tools/constants.ts';
import { appendManagedEvent } from '../event-log/write.ts';
import type { ExclusiveEffect } from '../execution-gate.ts';
import { ManagedWireObject } from '../protocol.ts';
import type { ManagedAgentScope } from '../protocol.ts';
import { sessionState, Slot } from '../scheduler.ts';
import { resolveManagedToolsets } from '../tools/resolve-toolsets.ts';
import { discoverManagedMcpTools } from './client.ts';
import type { ManagedMcpSettings } from './settings.ts';
import { ManagedMcpAuthenticationError } from './transport.ts';
import type { ManagedMcpContext, ManagedMcpTool } from './types.ts';

type Session = Awaited<ReturnType<typeof sessionState>>;
export type McpProjection = Pick<Session, 'publicSessionId' | 'threadId' | 'mcpServers' | 'mcpDescriptors'>;

const decodeObjects = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject));

const Descriptor = Schema.Struct({
  name: Schema.String,
  serverName: Schema.String,
  modelName: Schema.String,
  description: Schema.String,
  inputSchema: ManagedWireObject,
});

export function toolDescriptors(projection: McpProjection): ReadonlyArray<ManagedMcpTool> {
  return Schema.decodeUnknownSync(Schema.Array(Descriptor))(JSON.parse(projection.mcpDescriptors));
}

type RegistryOwner = {
  readonly settings: ManagedMcpSettings;
  readonly scope: ManagedAgentScope;
  readonly withControl: WithControl;
};

export function sessionMcpContext(
  projection: McpProjection,
  { settings, scope, withControl }: RegistryOwner,
): ManagedMcpContext {
  return {
    ...scope,
    settings,
    sessionId: projection.publicSessionId,
    threadId: projection.threadId,
    servers: decodeObjects(JSON.parse(projection.mcpServers)),
    authorize: (target) => withControl((store) => store.managed.vaults.resolveMcpAuthorization(target)),
  };
}

function catalogKey(state: Session): string {
  return createHash('sha256')
    .update(JSON.stringify([state.mcpServers, state.tools]))
    .digest('hex');
}

function awaitingInput(state: Session): boolean {
  const isIdle = state.submission === null && state.interrupt === null;

  return isIdle && !state.isArchived && state.pendingHead < state.pendingTail;
}

export function currentMcpSetting(serializedTools: string, serverName: string, toolName: string) {
  const entries = decodeObjects(JSON.parse(serializedTools)).filter(
    (entry) => entry['type'] === 'mcp_toolset' && entry['mcp_server_name'] === serverName,
  );

  for (const set of resolveManagedToolsets(entries)) {
    if (set.type === 'mcp_toolset') {
      return set.configs.find((tool) => tool.name === toolName) ?? set.default_config;
    }
  }

  return null;
}

function discoveryError(serverName: string, error: unknown): ManagedWireObject {
  const failure = {
    mcp_server_name: serverName,
    type: 'mcp_connection_failed_error',
    message: 'The MCP server could not provide its tools.',
    retry_status: { type: 'exhausted' },
  };

  if (error instanceof ManagedMcpAuthenticationError) {
    failure.type = 'mcp_authentication_failed_error';
    failure.message = 'Authentication to the MCP server failed.';
  }

  return failure;
}

export async function prepareSessionMcp(input: {
  readonly harness: Harness;
  readonly state: Session;
  readonly runtime: ManagedMcpContext;
  readonly exclusive: ExclusiveEffect;
}): Promise<McpProjection> {
  const { harness, state, runtime, exclusive } = input;

  if (!awaitingInput(state)) {
    return state;
  }

  const key = catalogKey(state);

  if (state.mcpCatalogKey === key || (runtime.servers.length === 0 && state.mcpDescriptors === '[]')) {
    return state;
  }

  const declarations = resolveManagedToolsets(
    decodeObjects(JSON.parse(state.tools)).filter((entry) => entry['type'] === 'mcp_toolset'),
  );

  const enabled = new Set<string>();

  for (const toolset of declarations) {
    if (
      toolset.type === 'mcp_toolset' &&
      (toolset.default_config.enabled || toolset.configs.some((tool) => tool.enabled))
    ) {
      enabled.add(toolset.mcp_server_name);
    }
  }

  return await exclusive(undefined, async () => {
    const tools: Array<ManagedMcpTool> = [];
    const errors: Array<ManagedWireObject> = [];
    let bytes = 0;
    const signal = AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS);

    for (const server of runtime.servers.filter((entry) => enabled.has(String(entry['name'])))) {
      const name = String(server['name']);

      try {
        signal.throwIfAborted();

        const discovered = await discoverManagedMcpTools({ ...runtime, signal, servers: [server] });
        const size = new TextEncoder().encode(JSON.stringify(discovered)).length;

        if (tools.length + discovered.length > MCP_MAX_TOOLS || bytes + size > TOOL_RESPONSE_MAX_BYTES) {
          throw new Error('MCP tool catalog limit exceeded');
        }

        tools.push(...discovered);

        bytes += size;
      } catch (error) {
        errors.push(discoveryError(name, error));
      }
    }

    return await harness.commit(async (transaction) => {
      const live = await sessionState(transaction, state.id);
      const slot = await transaction.doc(Slot);

      const isCurrent = slot.owner === live.id && awaitingInput(live);
      const needsProjection = catalogKey(live) === key && live.mcpCatalogKey !== key;

      if (isCurrent && needsProjection) {
        for (const error of errors) {
          await appendManagedEvent(transaction, { sessionId: live.id }, { type: 'session.error', error });
        }

        live.mcpDescriptors = JSON.stringify(tools);
        live.mcpCatalogKey = key;
      }

      return {
        publicSessionId: live.publicSessionId,
        threadId: live.threadId,
        mcpServers: live.mcpServers,
        mcpDescriptors: live.mcpDescriptors,
      };
    }, context);
  });
}

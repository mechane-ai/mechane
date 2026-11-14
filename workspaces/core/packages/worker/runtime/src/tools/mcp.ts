import { createMCPClient } from '@ai-sdk/mcp';
import type { ListToolsResult, MCPClient } from '@ai-sdk/mcp';
import type { ConnectionRecord, ToolGrantRecord } from '@mechane/control-store';
import { RemoteToolPolicy } from '@mechane/protocol';
import { toolExecutionId as executionId, HttpHeader } from '@mechane/records';
import { asSchema, dynamicTool, jsonSchema } from 'ai';
import type { ToolSet } from 'ai';
import { Redacted, Schema } from 'effect';
import { z } from 'zod';
import { NativeFields } from '../actor/records.ts';
import type { ExecutionReceipt } from '../domain.ts';
import { MCP_MAX_LIST_PAGES, MCP_MAX_TOOLS, TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import type { RuntimeToolStore } from './context.ts';
import { withToolStore } from './context.ts';
import { ToolNotStartedError } from './errors.ts';
import { boundedToolFetch } from './http.ts';
import { McpDefinition } from './mcp-definitions.ts';
import type { McpDiscovery } from './mcp-definitions.ts';
import { redactToolResult } from './redact.ts';
import { modelToolResult } from './tool-result.ts';
import type { RuntimeToolContext, ToolInvocation } from './types.ts';

type McpCall = ToolInvocation & {
  readonly connectionId: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
};

type McpSession = { readonly client: MCPClient; readonly credential: string | null };

type OpenMcpInput = {
  readonly store: RuntimeToolStore;
  readonly workspaceId: string;
  readonly connection: ConnectionRecord;
  readonly discoverySignal?: AbortSignal | undefined;
  readonly toolCallId?: string;
};

type PermittedToolInput = {
  readonly definition: ListToolsResult['tools'][number];
  readonly connection: ConnectionRecord;
  readonly grant: ToolGrantRecord;
};

type McpInvocationScope = {
  readonly input: McpCall;
  readonly store: RuntimeToolStore;
  readonly session: McpSession;
  readonly connection: ConnectionRecord;
};

const MCP_NAME_DIGEST_LENGTH = 12;
const MCP_READABLE_NAME_LENGTH = 32;

export async function discoverMcpTools(context: RuntimeToolContext): Promise<McpDiscovery> {
  return await withToolStore(async (store) => {
    const policy = await store.getRuntimePolicy(context);

    if (policy === null || policy.isSuspended) {
      return { tools: [], notices: ['Workspace access is suspended. Remote tools are unavailable.'], isComplete: true };
    }

    const grants = await store.listMcpGrants(context);
    const tools: Array<McpDefinition> = [];
    const notices: Array<string> = [];
    const availability = { isComplete: true };
    const discoverySignal = AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS);

    for (const grant of grants) {
      if (discoverySignal.aborted) {
        notices.push('Remote tool discovery exceeded its time budget. Remaining connections are unavailable.');

        return { tools, notices, isComplete: false };
      }

      const connection = await store.getMcpConnection({
        workspaceId: context.workspaceId,
        connectionId: grant.connectionId,
      });

      if (connection === null) {
        availability.isComplete = false;

        notices.push('A granted MCP connection is no longer available.');
      } else {
        const discovery = await describeMcpConnection({
          store,
          workspaceId: context.workspaceId,
          connection,
          grant,
          discoverySignal,
        });

        notices.push(...discovery.notices);

        availability.isComplete &&= discovery.isComplete;

        if (tools.length + discovery.tools.length > MCP_MAX_TOOLS) {
          availability.isComplete = false;

          notices.push(`The MCP connection ${connection.name} exceeds the tool limit. Narrow its granted tools.`);
        } else {
          tools.push(...discovery.tools);
        }
      }
    }

    return { tools, notices, isComplete: availability.isComplete };
  });
}

type DescribeConnectionInput = OpenMcpInput & { readonly grant: ToolGrantRecord };

async function describeMcpConnection({
  store,
  workspaceId,
  connection,
  grant,
  discoverySignal,
}: DescribeConnectionInput): Promise<McpDiscovery> {
  const { createHash } = await import('node:crypto');
  const notices: Array<string> = [];

  try {
    const session = await openMcp({ store, workspaceId, connection, discoverySignal });

    try {
      const definitions = await listMcpDefinitions(session.client);
      const permitted = definitions.tools.filter((definition) => isPermittedTool({ definition, connection, grant }));
      const nativeTools: ToolSet = session.client.toolsFromDefinitions({ tools: permitted });
      const tools: Array<McpDefinition> = [];

      for (const definition of permitted) {
        const native = nativeTools[definition.name];

        if (native === undefined) {
          throw new Error('The MCP tool could not be described');
        }

        const schema = asSchema(native.inputSchema);
        const inputSchema: unknown = await schema.jsonSchema;
        const schemaDocument = Schema.decodeUnknownSync(NativeFields)(inputSchema);

        const suffix = createHash('sha256')
          .update(JSON.stringify([connection.id, definition.name]))
          .digest('hex')
          .slice(0, MCP_NAME_DIGEST_LENGTH);

        const readableName = definition.name.replaceAll(/[^a-zA-Z0-9_]/gu, '_').slice(0, MCP_READABLE_NAME_LENGTH);

        tools.push(
          Schema.decodeUnknownSync(McpDefinition)({
            connectionId: connection.id,
            name: `mcp_${readableName}_${suffix}`,
            remoteName: definition.name,
            description: `MCP connection ${JSON.stringify(connection.name)}.\n\n${definition.description ?? definition.name}`,
            inputSchema: schemaDocument,
          }),
        );
      }

      if (
        session.credential !== null &&
        JSON.stringify(tools).includes(JSON.stringify(session.credential).slice(1, -1))
      ) {
        throw new Error('MCP descriptions contain credential material');
      }

      return { tools, notices, isComplete: true };
    } finally {
      const isClosed = await closeMcp(session.client);

      if (!isClosed) {
        notices.push(`The MCP connection ${connection.name} could not close its discovery session.`);
      }
    }
  } catch {
    notices.push(`The MCP connection ${connection.name} could not be loaded. Do not claim its tools are available.`);

    return { tools: [], notices, isComplete: false };
  }
}

export function mcpTools(context: RuntimeToolContext, definitions: ReadonlyArray<McpDefinition>): ToolSet {
  const tools: ToolSet = {};

  for (const definition of definitions) {
    tools[definition.name] = dynamicTool({
      description: definition.description,
      inputSchema: jsonSchema(definition.inputSchema),
      execute: async (argumentsValue, options) => {
        const argumentsObject = z.record(z.string(), z.unknown()).parse(argumentsValue);

        return await callMcp({
          ...context,
          toolCallId: options.toolCallId,
          connectionId: definition.connectionId,
          name: definition.remoteName,
          arguments: argumentsObject,
        });
      },
    });
  }

  return tools;
}

async function callMcp(input: McpCall): Promise<unknown> {
  try {
    return await withToolStore(async (store) => {
      const id = await executionId(input);
      const previous = await store.getExecution({ id, workspaceId: input.workspaceId, mechId: input.mechId });

      if (previous !== null) {
        return recordedMcpResult({ receipt: previous, id, runId: input.runId });
      }

      const policy = await store.getRuntimePolicy(input);
      const mech = await store.getMech(input);

      const connection = await store.getMcpConnection({
        workspaceId: input.workspaceId,
        connectionId: input.connectionId,
      });

      const grants = await store.listMcpGrants(input);
      const grant = grants.find((candidate) => candidate.connectionId === input.connectionId);
      const isActive = policy !== null && !policy.isSuspended && mech.status === 'active';
      const hasGrant = connection !== null && grant !== undefined;

      if (!isActive || !hasGrant) {
        return { status: 'refused', message: 'This MCP connection is no longer granted to the mech.' };
      }

      const session = await openMcp({
        store,
        workspaceId: input.workspaceId,
        connection,
        toolCallId: input.toolCallId,
      });

      const outcome: { value: unknown } = { value: null };

      try {
        outcome.value = await invokeMcp({ input, store, session, connection });
      } catch (error) {
        if (error instanceof ToolNotStartedError) {
          outcome.value = { status: 'refused', message: error.message };
        } else {
          outcome.value = {
            status: 'unavailable',
            message: 'The MCP operation could not be confirmed. Read its current state before trying another write.',
          };
        }
      }

      const isClosed = await closeMcp(session.client);

      if (!isClosed) {
        return {
          result: outcome.value,
          notice: 'The MCP operation returned, but its remote session could not be closed.',
        };
      }

      return outcome.value;
    });
  } catch {
    return { status: 'unavailable', message: 'The MCP connection could not be authorized or opened.' };
  }
}

type RecordedMcpInput = { readonly receipt: ExecutionReceipt; readonly id: string; readonly runId: string };

function recordedMcpResult({ receipt, id, runId }: RecordedMcpInput): unknown {
  if (receipt.kind !== 'mcp' || receipt.runId !== runId) {
    return { status: 'refused', message: 'This MCP identity belongs to another operation.' };
  }

  if (receipt.status === 'completed' && receipt.result !== null) {
    return modelToolResult({ executionId: id, output: receipt.result['output'] });
  }

  if (receipt.status === 'failed' && receipt.result?.['notStarted'] === true) {
    return receipt.result['output'];
  }

  return {
    status: 'uncertain',
    message: 'This MCP call was already attempted. Check its external effects before repeating it.',
  };
}

async function invokeMcp({ input, store, session, connection }: McpInvocationScope): Promise<unknown> {
  const definitions = await listMcpDefinitions(session.client);
  const definition = definitions.tools.find((candidate) => candidate.name === input.name);
  const current = await store.getMcpConnection({ workspaceId: input.workspaceId, connectionId: input.connectionId });
  const grants = await store.listMcpGrants(input);
  const currentGrant = grants.find((candidate) => candidate.connectionId === input.connectionId);

  const isSameConnection =
    current !== null && current.url === connection.url && current.secretReference === connection.secretReference;

  if (!isSameConnection || currentGrant === undefined) {
    return {
      status: 'refused',
      message: 'The MCP connection changed before execution. Discover its current tools again.',
    };
  }

  if (definition === undefined || !isPermittedTool({ definition, connection: current, grant: currentGrant })) {
    return { status: 'refused', message: 'This MCP tool is no longer allowed by the current grant.' };
  }

  const id = await executionId(input);

  if (!(await store.canDispatchExecution())) {
    throw new ToolNotStartedError('The originating generation no longer permits new work.');
  }

  const begun = await store.beginExecution({ id, runId: input.runId, kind: 'mcp' });

  if (!begun.wasCreated) {
    return recordedMcpResult({ receipt: begun.receipt, id, runId: input.runId });
  }

  if (!(await store.canDispatchExecution())) {
    const message = 'The originating generation no longer permits new work.';

    await store.finishExecution({
      id,
      status: 'failed',
      providerId: null,
      result: { notStarted: true, output: { status: 'refused', message } },
    });

    throw new ToolNotStartedError(message);
  }

  try {
    const raw = await session.client.callTool({
      name: input.name,
      arguments: input.arguments,
      options: { timeout: TOOL_REQUEST_TIMEOUT_MS, maxTotalTimeout: TOOL_REQUEST_TIMEOUT_MS },
    });

    const secrets: Array<string> = [];

    if (session.credential !== null) {
      secrets.push(session.credential);
    }

    const output = redactToolResult({ value: raw, secrets });

    await store.finishExecution({ id, status: 'completed', providerId: null, result: { output } });

    return modelToolResult({ executionId: id, output });
  } catch {
    const output = {
      status: 'uncertain',
      message: 'The MCP service did not confirm the result. Check its current state before repeating this operation.',
    };

    await store.finishExecution({ id, status: 'uncertain', providerId: null, result: { output } });

    return output;
  }
}

async function closeMcp(client: MCPClient): Promise<boolean> {
  try {
    await client.close();

    return true;
  } catch {
    return false;
  }
}

async function openMcp({
  store,
  workspaceId,
  connection,
  discoverySignal,
  toolCallId,
}: OpenMcpInput): Promise<McpSession> {
  const headers: Record<string, string> = { [HttpHeader.UserAgent]: 'Mechane-MCP/1.0' };
  const credential: { value: string | null } = { value: null };

  if (toolCallId !== undefined) {
    headers['x-mechane-tool-call-id'] = toolCallId;
  }

  if (connection.secretReference !== null) {
    const stored = await store.getCredential({ workspaceId, reference: connection.secretReference });

    if (stored === null) {
      throw new Error('The MCP credential is unavailable');
    }

    credential.value = Redacted.value(stored);
    headers['Authorization'] = `Bearer ${credential.value}`;
  }

  const client = await createMCPClient({
    transport: { type: 'http', url: connection.url, headers, fetch: boundedToolFetch(discoverySignal) },
    initializationOptions: { timeout: TOOL_REQUEST_TIMEOUT_MS, maxTotalTimeout: TOOL_REQUEST_TIMEOUT_MS },
    maxRetries: 0,
  });

  return { client, credential: credential.value };
}

async function listMcpDefinitions(client: MCPClient): Promise<ListToolsResult> {
  const tools: ListToolsResult['tools'] = [];
  const page: { cursor: string | undefined } = { cursor: undefined };

  for (let index = 0; index < MCP_MAX_LIST_PAGES; index += 1) {
    const params: { cursor?: string } = {};

    if (page.cursor !== undefined) {
      params.cursor = page.cursor;
    }

    const result = await client.listTools({ params, options: { timeout: TOOL_REQUEST_TIMEOUT_MS } });

    tools.push(...result.tools);

    if (result.nextCursor === undefined) {
      return { tools };
    }

    if (result.nextCursor === page.cursor) {
      throw new Error('The MCP tool list repeated its page');
    }

    page.cursor = result.nextCursor;
  }

  throw new Error('The MCP tool list exceeds the page limit');
}

function isPermittedTool({ definition, connection, grant }: PermittedToolInput): boolean {
  if (!connection.allowedTools.includes(definition.name) || !grant.tools.includes(definition.name)) {
    return false;
  }

  if (definition.annotations?.readOnlyHint !== false) {
    return true;
  }

  return connection.policy === RemoteToolPolicy.IdempotentFree && definition.annotations.idempotentHint === true;
}

callMcp.maxRetries = 0;

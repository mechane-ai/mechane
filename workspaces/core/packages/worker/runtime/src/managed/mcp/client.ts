import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { MCP_MAX_TOOLS, TOOL_REQUEST_TIMEOUT_MS } from '../../tools/constants.ts';
import { ManagedWireObject } from '../protocol.ts';
import { managedMcpFailure, managedMcpResult } from './result.ts';
import { MCP_ENVELOPE_TRUNCATED } from './settings.ts';
import {
  closeManagedMcp,
  connectManagedMcp,
  ManagedMcpAuthenticationError,
  managedMcpDefinitions,
} from './transport.ts';
import type { ManagedMcpContext, ManagedMcpResult, ManagedMcpTool } from './types.ts';

const VISIBLE_NAME_MAX_CHARS = 32;
const digestLength = 12;

function toolName(server: string, tool: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify([server, tool]))
    .digest('hex')
    .slice(0, digestLength);

  const readable = tool.replaceAll(/[^a-zA-Z0-9_]/gu, '_').slice(0, VISIBLE_NAME_MAX_CHARS);

  return `mcp_${readable}_${digest}`;
}

function readToolDescriptor(
  definition: Awaited<ReturnType<typeof managedMcpDefinitions>>[number],
  serverName: string,
  secrets: ReadonlySet<string>,
): ManagedMcpTool {
  const descriptor = {
    serverName,
    name: definition.name,
    modelName: toolName(serverName, definition.name),
    description: definition.description ?? definition.name,
    inputSchema: Schema.decodeUnknownSync(ManagedWireObject)(definition.inputSchema),
  };

  const serialized = JSON.stringify(descriptor);

  if ([...secrets].some((secret) => secret.length > 0 && serialized.includes(JSON.stringify(secret).slice(1, -1)))) {
    throw new Error('MCP descriptor contains credential material');
  }

  return descriptor;
}

export async function discoverManagedMcpTools(context: ManagedMcpContext): Promise<ReadonlyArray<ManagedMcpTool>> {
  const tools: Array<ManagedMcpTool> = [];

  for (const server of context.servers) {
    const serverName = server['name'];

    if (typeof serverName !== 'string') {
      throw new TypeError('Invalid MCP server name');
    }

    const connection = await connectManagedMcp(context, server);

    try {
      const definitions = await managedMcpDefinitions(connection.client);

      if (tools.length + definitions.length > MCP_MAX_TOOLS) {
        throw new Error('MCP tool limit exceeded');
      }

      const descriptors = definitions.map((definition) =>
        readToolDescriptor(definition, serverName, connection.secrets),
      );

      tools.push(...descriptors);
    } catch (error) {
      if (connection.isAuthenticationFailed) {
        throw new ManagedMcpAuthenticationError('MCP authorization failed');
      }

      throw error;
    } finally {
      await closeManagedMcp(connection.client);
    }
  }

  if (new Set(tools.map((tool) => tool.modelName)).size !== tools.length) {
    throw new Error('MCP servers returned duplicate tool names');
  }

  return tools;
}

type Invocation = {
  readonly context: ManagedMcpContext;
  readonly serverName: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly beforeDispatch: () => Promise<void>;
};

export async function callManagedMcpTool({
  context,
  serverName,
  name,
  input,
  beforeDispatch,
}: Invocation): Promise<ManagedMcpResult> {
  const server = context.servers.find((candidate) => candidate['name'] === serverName);

  if (server === undefined) {
    return managedMcpFailure('The requested MCP server is not available to this session.');
  }

  try {
    const dispatch = { isStarted: false };

    const connection = await connectManagedMcp(context, server, async () => {
      await beforeDispatch();

      dispatch.isStarted = true;
    });

    try {
      const definitions = await managedMcpDefinitions(connection.client);

      if (!definitions.some((definition) => definition.name === name)) {
        return managedMcpFailure('The MCP tool is no longer available.');
      }

      try {
        const raw = await connection.client.callTool({
          name,
          arguments: input,
          options: { timeout: TOOL_REQUEST_TIMEOUT_MS, maxTotalTimeout: TOOL_REQUEST_TIMEOUT_MS },
        });

        return managedMcpResult(raw, [...connection.secrets], context.settings.maxResultBytes);
      } catch {
        if (dispatch.isStarted && connection.isResponseTruncated) {
          return managedMcpFailure(MCP_ENVELOPE_TRUNCATED);
        }

        if (dispatch.isStarted) {
          return managedMcpFailure(
            'The MCP service did not confirm the outcome. Check its state before repeating this operation.',
          );
        }

        return managedMcpFailure('The MCP call was not authorized for dispatch.');
      }
    } finally {
      await closeManagedMcp(connection.client);
    }
  } catch {
    return managedMcpFailure('The MCP tool could not be authorized or contacted before dispatch.');
  }
}

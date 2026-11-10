import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { startHttpService } from '@mechane/stack';
import { Schema } from 'effect';
import { waitFor } from '../wait-for.ts';

const FixtureTool = { Read: 'fixture_read', Write: 'fixture_write', Unsafe: 'fixture_unsafe' } as const;

const RpcRequest = Schema.Struct({
  id: Schema.optionalKey(Schema.Unknown),
  method: Schema.String,
  params: Schema.optionalKey(Schema.Unknown),
});

const ToolRequest = Schema.Struct({ name: Schema.Enum(FixtureTool), arguments: Schema.Unknown });

const WriteArguments = Schema.Struct({ requestID: Schema.String });
const MCP_PROTOCOL_VERSION = '2025-03-26';
const MCP_NOTIFICATION_ACCEPTED_STATUS = 202;

const descriptions = {
  read: 'Read the MCP policy fixture',
  write: 'Write the MCP policy fixture idempotently',
  unsafe: 'Write the MCP policy fixture without idempotency',
} as const;

const emptyInput = { type: 'object', properties: {} } as const;

const tools = [
  {
    name: FixtureTool.Read,
    description: descriptions.read,
    inputSchema: emptyInput,
    annotations: { readOnlyHint: true },
  },
  {
    name: FixtureTool.Write,
    description: descriptions.write,
    inputSchema: { type: 'object', properties: { requestID: { type: 'string' } }, required: ['requestID'] },
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: FixtureTool.Unsafe,
    description: descriptions.unsafe,
    inputSchema: emptyInput,
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
] as const;

export type McpFixture = {
  readonly origin: URL;
  readonly names: typeof FixtureTool;
  readonly descriptions: typeof descriptions;
  readonly readCalls: () => ReadonlyArray<string>;
  readonly holdNextDiscovery: () => McpDiscoveryGate;
  readonly close: () => Promise<void>;
};

type McpDiscoveryGate = { readonly waitForRequest: () => Promise<void>; readonly release: () => void };
type DiscoveryGate = { readonly released: ReturnType<typeof Promise.withResolvers<void>> };

export async function startMcpFixture(): Promise<McpFixture> {
  const calls: Array<string> = [];
  const writes = new Set<string>();
  const pendingDiscovery: Array<DiscoveryGate> = [];
  const discoveryGates: Array<DiscoveryGate> = [];
  const requestedDiscovery = new Set<DiscoveryGate>();

  function holdNextDiscovery(): McpDiscoveryGate {
    const gate: DiscoveryGate = { released: Promise.withResolvers<void>() };

    pendingDiscovery.push(gate);
    discoveryGates.push(gate);

    return {
      waitForRequest: async () => {
        await waitFor({
          name: 'the admitted tool to reach MCP discovery',
          read: async () => requestedDiscovery.has(gate),
          accept: (requested) => requested,
        });
      },
      release: () => gate.released.resolve(),
    };
  }

  async function handle(request: Request): Promise<Response> {
    if (request.method !== HttpMethod.Post) {
      return new Response(null, { status: HttpStatusCode.MethodNotAllowed });
    }

    const message = Schema.decodeUnknownSync(RpcRequest)(await request.json());

    if (message.id === undefined) {
      return new Response(null, { status: MCP_NOTIFICATION_ACCEPTED_STATUS });
    }

    switch (message.method) {
      case 'initialize':
        return Response.json({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'MCP policy fixture', version: '1.0.0' },
          },
        });
      case 'tools/list': {
        const gate = pendingDiscovery.shift();

        if (gate !== undefined) {
          requestedDiscovery.add(gate);
          await gate.released.promise;
        }

        return Response.json({ jsonrpc: '2.0', id: message.id, result: { tools } });
      }
      case 'tools/call': {
        const tool = Schema.decodeUnknownSync(ToolRequest)(message.params);

        if (tool.name === FixtureTool.Write) {
          const input = Schema.decodeUnknownSync(WriteArguments)(tool.arguments);

          if (!writes.has(input.requestID)) {
            writes.add(input.requestID);
            calls.push(tool.name);
          }
        } else {
          calls.push(tool.name);
        }

        return Response.json({
          jsonrpc: '2.0',
          id: message.id,
          result: { content: [{ type: 'text', text: 'The fixture operation committed.' }] },
        });
      }
      default:
        throw new Error('The fixture received an unsupported MCP method');
    }
  }

  const service = await startHttpService(handle);

  return {
    origin: service.origin,
    names: FixtureTool,
    descriptions,
    readCalls: () => [...calls],
    holdNextDiscovery,
    close: async () => {
      for (const gate of discoveryGates) {
        gate.released.resolve();
      }

      await service.close();
    },
  };
}

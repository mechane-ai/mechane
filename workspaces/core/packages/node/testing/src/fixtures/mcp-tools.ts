import { ConnectionDeletion, RemoteConnection, ToolGrant } from '@mechane/protocol';
import type { RemoteToolPolicy } from '@mechane/protocol';
import type { ModelFixture } from '@mechane/stack';
import { Record, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { runCli } from '../cli/run-cli.ts';
import { sendNotification, waitForTurn } from '../mechs.ts';
import { startHeldActivation } from '../start-held-activation.ts';
import type { MechContext } from '../types.ts';
import type { McpFixture } from './mcp.ts';

const OfferedModelTool = Schema.Struct({
  function: Schema.Struct({ name: Schema.String, description: Schema.optionalKey(Schema.String) }),
});

type OfferedModelTool = typeof OfferedModelTool.Type;

type ConnectionInput = MechContext & {
  readonly fixture: McpFixture;
  readonly connectionId?: string;
  readonly policy: RemoteToolPolicy;
};

type GrantInput = MechContext & { readonly fixture: McpFixture; readonly connectionId: string };
type ConnectionRemoval = MechContext & { readonly connectionId: string };

type McpConnectionUse = Omit<ConnectionInput, 'connectionId'> & {
  readonly use: (connection: RemoteConnection) => Promise<void>;
};

type DiscoveryInput = MechContext & { readonly model: ModelFixture; readonly marker: string };
type HeldInvocationInput = DiscoveryInput & { readonly toolName: string };
type FindToolInput = { readonly tools: ReadonlyArray<OfferedModelTool>; readonly description: string };

export async function configureMcpConnection({
  stack,
  account,
  fixture,
  connectionId,
  policy,
}: ConnectionInput): Promise<RemoteConnection> {
  const args = ['connection'];

  if (connectionId === undefined) {
    args.push('create');
  } else {
    args.push('update', connectionId);
  }

  args.push(
    '--name',
    'MCP policy fixture',
    '--url',
    fixture.origin.href,
    '--allowed-tools',
    JSON.stringify(Record.values(fixture.names)),
    '--policy',
    policy,
    '--workspace',
    account.workspaceId,
  );

  return await runCli({ stack, account, args, schema: RemoteConnection });
}

export async function grantMcpTools(input: GrantInput): Promise<void> {
  await runCli({
    ...input,
    args: [
      'grant',
      'set',
      input.mechId,
      input.connectionId,
      '--tools',
      JSON.stringify(Record.values(input.fixture.names)),
      '--workspace',
      input.account.workspaceId,
    ],
    schema: ToolGrant,
  });
}

async function removeMcpConnection({ stack, account, connectionId }: ConnectionRemoval): Promise<void> {
  await runCli({
    stack,
    account,
    args: ['connection', 'delete', connectionId, '--workspace', account.workspaceId],
    schema: ConnectionDeletion,
  });
}

export async function withMcpConnection({ use, ...input }: McpConnectionUse): Promise<void> {
  const failures: Array<unknown> = [];
  const owned: { connectionId?: string } = {};

  try {
    const connection = await configureMcpConnection(input);
    owned.connectionId = connection.id;

    await use(connection);
  } catch (cause) {
    failures.push(cause);
  } finally {
    if (owned.connectionId !== undefined) {
      await removeMcpConnection({ ...input, connectionId: owned.connectionId }).catch((cause: unknown) =>
        failures.push(cause),
      );
    }

    await input.fixture.close().catch((cause: unknown) => failures.push(cause));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The MCP scenario or connection retirement failed');
  }
}

export async function discoverMcpTools({
  stack,
  account,
  mechId,
  model,
  marker,
}: DiscoveryInput): Promise<ReadonlyArray<OfferedModelTool>> {
  model.configure({ marker, replies: [{ text: 'The current tools were inspected.' }] });

  const sent = await sendNotification({ stack, account, mechId, text: marker });
  const call = await model.waitForCall({ marker, index: 0 });

  await waitForTurn({ stack, account, mechId, notificationId: sent.id });

  return Schema.decodeUnknownSync(Schema.Array(OfferedModelTool))(call.body['tools']);
}

export function findOfferedMcpTool({ tools, description }: FindToolInput): string | undefined {
  return tools.find((tool) => tool.function.description?.includes(description) === true)?.function.name;
}

export async function startHeldMcpInvocation(input: HeldInvocationInput) {
  const toolCallId = randomUUID();

  input.model.configure({
    marker: input.marker,
    replies: [
      { isHeld: true, tools: [{ id: toolCallId, name: input.toolName, input: { requestID: randomUUID() } }] },
      { text: 'The pending MCP invocation was reconsidered.' },
    ],
  });

  const { turn } = await startHeldActivation(input);

  return { turn, toolCallId };
}

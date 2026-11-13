import type { Context } from '@earendil-works/chord/context';
import { defineTool } from '@earendil-works/pi-durable';
import type { TaskId, ToolExecutionApi, ToolExecutionResult, ToolRegistration, Tx } from '@earendil-works/pi-durable';
import { createBashRegistration } from '@mechane-ai/bash';
import { toolExecutionId as executionId } from '@mechane/records';
import { asSchema } from 'ai';
import type { ToolSet } from 'ai';
import { Record, Schema } from 'effect';
import { Effects, Messages, Observations, ToolTransitions } from '../actor/collections.ts';
import { State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { toolStore } from '../execution/receipts.ts';
import { appendEvent } from '../notifications/admission.ts';
import { isExecutionCurrent } from './admission.ts';
import { hasBashJoin, joinBash } from './bash-task.ts';
import type { BashExecutionTask } from './bash-task.ts';
import { observeBash } from './bash.ts';
import { browserModelOutput, readBrowserToolResult } from './browser/browser-result.ts';
import { joinBrowser } from './browser/browser-task.ts';
import type { BrowserExecutionTask } from './browser/browser-task.ts';
import { createBrowserTools } from './browser/browser-tools.ts';
import { withToolOwner } from './context.ts';
import { ToolNotStartedError } from './errors.ts';
import type { McpDefinition, McpDiscovery } from './mcp-definitions.ts';
import { joinProcessAdmission } from './processes/process-task.ts';
import type { ProcessAdmissionTask } from './processes/process-task.ts';
import { processTools } from './processes/process-tools.ts';
import { prepareRuntimeTools, runtimeTools } from './runtime-tools.ts';
import { executeSandboxShell } from './sandbox-environment.ts';
import type { ToolInvocation } from './types.ts';

async function invocation(access: ActorAccess, api: ToolExecutionApi, context: Context): Promise<ToolInvocation> {
  const task = await api.getTask(api.taskId, context);
  const owner = task?.owner;

  if (owner === undefined) {
    throw new Error('The tool has no native generation owner');
  }

  const observation = await Observations.get(access.harness, String(owner), context);

  if (observation === undefined) {
    throw new Error('The tool has no generation-bound observed input');
  }

  return {
    ...access.scope,
    runId: observation.turnId,
    sessionId: access.scope.mechId,
    toolCallId: `${access.scope.mechId}:${String(api.taskId)}`,
  };
}

type GuardedToolInput = {
  readonly access: ActorAccess;
  readonly api: ToolExecutionApi;
  readonly context: Context;
  readonly name: string;
};

type ReceiptIdentity = {
  readonly name: string;
  readonly runId: string;
  readonly execution: string;
  readonly publication: string;
  readonly hasReceiptJoin: boolean;
};

async function canReconcileReceipt(transaction: Tx, identity: ReceiptIdentity): Promise<boolean> {
  const isAddressedAdapter =
    identity.name.startsWith('browser_') || identity.name.startsWith('mcp_') || identity.name === 'start_process';

  const mayReadEffect = identity.hasReceiptJoin || isAddressedAdapter;

  if (mayReadEffect) {
    const effect = await Effects.read(transaction, identity.execution);

    if (effect?.runId === identity.runId) {
      return true;
    }
  }

  if (identity.name === 'console_message') {
    return (await Messages.read(transaction, identity.publication)) !== undefined;
  }

  return false;
}

async function runAdmittedTool(
  { access, context }: GuardedToolInput,
  owner: { readonly invocation: ToolInvocation; readonly generationTaskId: TaskId | undefined },
  execute: (input: ToolInvocation) => Promise<ToolExecutionResult>,
): Promise<ToolExecutionResult> {
  const { invocation: toolInvocation, generationTaskId } = owner;

  try {
    return await withToolOwner(
      {
        configuration: access.configuration,
        withStore: async (operation) =>
          await access.withControl((control) =>
            operation(
              toolStore(access, control, async (transaction) => {
                if (generationTaskId === undefined) {
                  return false;
                }

                return await isExecutionCurrent(
                  { access, generationTaskId, runId: toolInvocation.runId, transaction },
                  context,
                );
              }),
            ),
          ),
      },
      async () => await execute(toolInvocation),
    );
  } catch (cause) {
    if (cause instanceof ToolNotStartedError) {
      return {
        isError: true,
        output: [{ type: 'text', text: JSON.stringify({ status: 'not_started', reason: 'execution_stopped' }) }],
      };
    }

    throw cause;
  }
}

async function guarded(
  { access, api, context, name }: GuardedToolInput,
  execute: (input: ToolInvocation) => Promise<ToolExecutionResult>,
): Promise<ToolExecutionResult> {
  const input = await invocation(access, api, context);
  const task = await api.getTask(api.taskId, context);
  const execution = await executionId(input);
  const publication = await executionId({ runId: input.runId, toolCallId: `message:${input.toolCallId}` });
  const hasReceiptJoin = name === 'bash' && (await hasBashJoin(api, context));
  const identity = { name, runId: input.runId, execution, publication, hasReceiptJoin };

  const admission = await access.harness.commit(async (transaction) => {
    const mayReconcile = await canReconcileReceipt(transaction, identity);
    let canExecute = false;

    if (!mayReconcile && task?.owner !== undefined) {
      canExecute = await isExecutionCurrent(
        { access, generationTaskId: task.owner, runId: input.runId, transaction },
        context,
      );
    }

    if (!canExecute && !mayReconcile) {
      const observation = await Observations.read(transaction, String(task?.owner));

      await appendEvent(transaction, {
        type: 'tool.not_started',
        runId: input.runId,
        payload: { toolName: name, taskId: api.taskId, reason: 'unobserved_notification_or_execution_fence' },
      });

      let reason = 'notifications_pending';

      const state = await transaction.doc(State);

      if (observation === undefined || observation.sequence >= state.notificationBaseSequence) {
        reason = 'execution_stopped';
      }

      return { admitted: false, reason };
    }

    const transition = `${String(api.taskId)}:tool.started`;

    if ((await ToolTransitions.read(transaction, transition)) === undefined) {
      await appendEvent(transaction, {
        type: 'tool.started',
        runId: input.runId,
        payload: { toolName: name, toolCallId: api.callId, nativeTaskId: api.taskId },
      });
      await ToolTransitions.put(transaction, transition, transition);
    }

    return { admitted: true, reason: '' };
  }, context);

  if (!admission.admitted) {
    return {
      isError: true,
      output: [{ type: 'text', text: JSON.stringify({ status: 'not_started', reason: admission.reason }) }],
    };
  }

  const result = await runAdmittedTool(
    { access, api, context, name },
    { invocation: input, generationTaskId: task?.owner },
    execute,
  );

  await access.harness.commit(async (transaction) => {
    let type = 'tool.completed';

    if (result.isError === true) {
      type = 'tool.failed';
    }

    const transition = `${String(api.taskId)}:${type}`;

    if ((await ToolTransitions.read(transaction, transition)) === undefined) {
      await appendEvent(transaction, {
        type,
        runId: input.runId,
        payload: { toolName: name, toolCallId: api.callId, nativeTaskId: api.taskId },
      });
      await ToolTransitions.put(transaction, transition, transition);
    }
  }, context);

  return result;
}

type CreatePiToolsInput = {
  readonly access: ActorAccess;
  readonly bashTask: BashExecutionTask;
  readonly browserTask: BrowserExecutionTask;
  readonly processTask: ProcessAdmissionTask;
  readonly shouldDiscoverMcp: boolean;
};

type ExecutionToolsInput = {
  readonly name: string;
  readonly invocation: ToolInvocation;
  readonly browserTask: BrowserExecutionTask;
  readonly processTask: ProcessAdmissionTask;
  readonly api: ToolExecutionApi;
  readonly mcpDefinitions: ReadonlyArray<McpDefinition>;
};

type PreparedPiTools = { readonly tools: ReadonlyArray<ToolRegistration>; readonly configuration: McpDiscovery };

type RestorePiToolsInput = Omit<CreatePiToolsInput, 'shouldDiscoverMcp'> & { readonly configuration: McpDiscovery };

type RegisterPiToolsInput = Omit<CreatePiToolsInput, 'shouldDiscoverMcp'> & {
  readonly prepared: Awaited<ReturnType<typeof prepareRuntimeTools>>;
};

function executionTools(
  { name, invocation: input, browserTask, processTask, api, mcpDefinitions }: ExecutionToolsInput,
  context: Context,
): ToolSet {
  if (name.startsWith('browser_')) {
    return createBrowserTools({
      ...input,
      executeAction: async (browserInvocation) =>
        await joinBrowser({ task: browserTask, invocation: browserInvocation, api }, context),
    });
  }

  if (name === 'start_process') {
    return processTools({
      ...input,
      executeStart: async (processInvocation) =>
        await joinProcessAdmission({ task: processTask, invocation: processInvocation, api }, context),
    });
  }

  return runtimeTools({ ...input, mcpDefinitions: mcpDefinitions.filter((definition) => definition.name === name) });
}

export async function createPiTools({
  access,
  bashTask,
  browserTask,
  processTask,
  shouldDiscoverMcp,
}: CreatePiToolsInput): Promise<PreparedPiTools> {
  const placeholder = { ...access.scope, sessionId: access.scope.mechId, runId: access.scope.mechId };

  const prepared = await withToolOwner(
    {
      configuration: access.configuration,
      withStore: async (operation) => await access.withControl((control) => operation(toolStore(access, control))),
    },
    async () => await prepareRuntimeTools({ ...placeholder, shouldDiscoverMcp }),
  );

  return await registerPiTools({ access, bashTask, browserTask, processTask, prepared });
}

export async function restorePiTools({
  access,
  bashTask,
  browserTask,
  processTask,
  configuration,
}: RestorePiToolsInput): Promise<PreparedPiTools> {
  const placeholder = { ...access.scope, sessionId: access.scope.mechId, runId: access.scope.mechId };

  const prepared = {
    tools: runtimeTools({ ...placeholder, mcpDefinitions: configuration.tools }),
    notices: configuration.notices,
    mcpDefinitions: configuration.tools,
    isComplete: configuration.isComplete,
  };

  return await registerPiTools({ access, bashTask, browserTask, processTask, prepared });
}

async function registerPiTools({
  access,
  bashTask,
  browserTask,
  processTask,
  prepared,
}: RegisterPiToolsInput): Promise<PreparedPiTools> {
  const registrations: Array<ToolRegistration> = [];

  const nativeBash = createBashRegistration({
    cwd: '/home/node',
    // oxlint-disable-next-line max-params -- Pi shell execution gains the invocation-bound native tool API.
    execute: async (command, options, api, context) => {
      const input = await invocation(access, api, context);

      return await executeSandboxShell({
        command,
        options,
        context,
        api,
        invocation: input,
        execute: async (bashInvocation, bashContext) =>
          await joinBash({ task: bashTask, invocation: bashInvocation, api }, bashContext),
      });
    },
  });

  registrations.push({
    ...nativeBash,
    replay: 'safe',
    execute: async (argumentsValue: Parameters<typeof nativeBash.execute>[0], api, context) =>
      await guarded({ access, api, context, name: 'bash' }, async (input) => {
        const result = await nativeBash.execute(argumentsValue, api, context);
        const structured = result.structuredOutput;

        if (structured === null || typeof structured !== 'object' || Array.isArray(structured)) {
          return result;
        }

        const receipt = await observeBash({ ...input, executionId: await executionId(input) });

        return {
          ...result,
          structuredOutput: {
            ...structured,
            truncated: structured['truncated'] === true || receipt.isTruncated === true,
          },
        };
      }),
  });

  for (const [name, candidate] of Record.toEntries(prepared.tools).filter(([toolName]) => toolName !== 'bash')) {
    const schema: unknown = await asSchema(candidate.inputSchema).jsonSchema;
    const parameters = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(schema);

    let description = name;
    let replay: 'safe' | 'unsafe' = 'safe';

    if (typeof candidate.description === 'string') {
      description = candidate.description;
    }

    if (name.startsWith('mcp_')) {
      replay = 'unsafe';
    }

    registrations.push(
      defineTool({
        name,
        description,
        parameters,
        replay,
        executionMode: 'sequential',
        execute: async (argumentsValue, api, context) =>
          await guarded({ access, api, context, name }, async (input) => {
            const tools = executionTools(
              { name, invocation: input, browserTask, processTask, api, mcpDefinitions: prepared.mcpDefinitions },
              context,
            );

            const tool = tools[name];
            const execute = tool?.execute;

            if (tool?.type === 'provider' || execute === undefined) {
              return {
                isError: true,
                output: [{ type: 'text', text: 'This tool is no longer available under the current grant' }],
              };
            }

            const output: unknown = await Reflect.apply(execute, undefined, [
              argumentsValue,
              {
                toolCallId: input.toolCallId,
                messages: [],
                context: {},
                abortSignal: context.abortSignal ?? new AbortController().signal,
              },
            ]);

            if (name.startsWith('browser_')) {
              const model = browserModelOutput({ output: readBrowserToolResult(output) });

              if (model.type === 'text') {
                return { output: [{ type: 'text', text: model.value }] };
              }

              return {
                output: model.value.map((part) => {
                  if (part.type === 'text') {
                    return { type: 'text' as const, text: part.text };
                  }

                  return { type: 'image' as const, data: part.data.data, mimeType: part.mediaType };
                }),
              };
            }

            return { output: [{ type: 'text', text: JSON.stringify(output) }] };
          }),
      }),
    );
  }

  return {
    tools: registrations,
    configuration: { tools: prepared.mcpDefinitions, notices: prepared.notices, isComplete: prepared.isComplete },
  };
}

import { WorkflowAgent } from '@ai-sdk/workflow';
import type { ModelCallStreamPart } from '@ai-sdk/workflow';
import { stepCountIs } from 'ai';
import type { ModelMessage } from 'ai';
import { Record } from 'effect';
import { createHook, getWritable } from 'workflow';
import { prepareAgentContext } from '../models/context-policy.ts';
import { RuntimeModel } from '../models/runtime-model.ts';
import { checkpointActivation } from '../tools/activation-checkpoint.ts';
import { importExistingNotes } from '../tools/imported-notes.ts';
import { prepareRuntimeTools } from '../tools/runtime-tools.ts';
import { admissionToken } from './admission-token.ts';
import { readNotifications } from './notifications.ts';
import { loadRunContext } from './run-context.ts';
import { recordToolActivity, saveRunProgress, saveRunTrace } from './run-progress.ts';
import {
  claimRun,
  closeRunStream,
  failRun,
  finishRun,
  markEnvironmentCheckpointCommitted,
  readTerminalRun,
} from './run-state.ts';
import type { RunOutcome } from './types.ts';

const MAXIMUM_AGENT_STEPS = 64;
const CONTINUATION_FINISH_REASONS: ReadonlySet<string> = new Set(['tool-calls', 'length']);

export async function runWorkflow(runId: string): Promise<RunOutcome> {
  'use workflow';

  return await executeAdmission(runId);
}

async function executeAdmission(runId: string): Promise<RunOutcome> {
  try {
    const hook = createHook<{ readonly runId: string }>({ token: admissionToken(runId) });

    await hook.getConflict();

    const state = { status: await claimRun(runId) };

    while (state.status === 'queued') {
      await hook;

      state.status = await claimRun(runId);
    }

    if (state.status === 'terminal') {
      const outcome = await readTerminalRun(runId);

      await closeRunStream(outcome);

      return outcome;
    }

    return await executeRun(runId);
  } catch {
    return await failRun(runId);
  }
}

async function executeRun(runId: string): Promise<RunOutcome> {
  try {
    const context = await loadRunContext(runId);

    if (context.isEnvironmentCheckpointRequired) {
      try {
        await checkpointActivation({ runId, checkpointSequence: context.checkpointSequence });
        await markEnvironmentCheckpointCommitted(runId);
      } catch {
        return await failRun(runId, 'environment_checkpoint');
      }
    }

    try {
      await importExistingNotes({ runId });
    } catch {
      return await failRun(runId, 'note_import');
    }

    const traceMessages: Array<ModelMessage> = [];

    const progress = {
      messages: context.messages,
      traceMessages,
      presentedSequence: context.presentedSequence,
      checkpointSequence: context.checkpointSequence,
    };

    const initial = await readNotifications({ runId, afterSequence: progress.presentedSequence });

    progress.messages = [...progress.messages, ...initial.messages];

    progress.traceMessages.push(...initial.messages);

    progress.presentedSequence = initial.presentedSequence;

    if (progress.messages.length === 0) {
      const wake: ModelMessage = {
        role: 'user',
        content:
          'Private runtime wake. Review your durable notes and any unfinished work. No outward response is required.',
      };

      progress.messages = [...progress.messages, wake];

      progress.traceMessages.push(wake);
    }

    await saveRunTrace({ runId, messages: progress.traceMessages });

    const prepared = await prepareRuntimeTools(context.identity);
    const tools = prepared.tools;
    const instructions = [context.instructions, ...prepared.notices].join('\n\n');
    const reference = { ...context.identity, modelId: context.model };
    const policy = await prepareAgentContext({ reference, instructions, messages: progress.messages });

    progress.messages = policy.messages;
    progress.checkpointSequence += 1;

    await saveRunProgress({ runId, ...progress });

    const model = new RuntimeModel(reference);

    const agent = new WorkflowAgent({
      model,
      instructions,
      tools,
      maxRetries: 0,
      maxOutputTokens: context.maxOutputTokens,
      stopWhen: [
        stepCountIs(MAXIMUM_AGENT_STEPS),
        ({ steps }) => policy.exceedsWindow([...progress.messages, ...(steps.at(-1)?.response.messages ?? [])]),
      ],
      toolCallConcurrency: 1,
      allowSystemInMessages: true,
      prepareStep: async (step) => {
        const batch = await readNotifications({ runId, afterSequence: progress.presentedSequence });

        progress.messages = [...progress.messages, ...batch.messages];

        progress.traceMessages.push(...batch.messages);

        progress.presentedSequence = batch.presentedSequence;

        await saveRunTrace({ runId, messages: progress.traceMessages });

        progress.messages = await policy.compact(progress.messages);
        progress.checkpointSequence += 1;

        await saveRunProgress({ runId, ...progress });

        const notifications = batch.messages.map((message) => ({
          role: message.role,
          content: [{ type: 'text' as const, text: message.content }],
        }));

        const messages = [...step.messages, ...notifications];
        const compacted = await policy.prepareStep({ messages });
        const toolsContext = Record.map(tools, () => ({ presentedSequence: progress.presentedSequence }));

        return { messages: compacted.messages, toolsContext };
      },
      onToolExecutionStart: async ({ toolCall }) =>
        await recordToolActivity({
          runId,
          toolCallId: toolCall.toolCallId,
          name: toolCall.toolName,
          status: 'running',
        }),
      onToolExecutionEnd: async (event) => {
        if (event.success) {
          await recordToolActivity({
            runId,
            toolCallId: event.toolCall.toolCallId,
            name: event.toolCall.toolName,
            status: toolCompletionStatus({ output: event.output }),
            durationMs: event.durationMs,
          });

          return;
        }

        await recordToolActivity({
          runId,
          toolCallId: event.toolCall.toolCallId,
          name: event.toolCall.toolName,
          status: 'failed',
          durationMs: event.durationMs,
        });
      },
      onStepEnd: async (event) => {
        progress.messages = [...progress.messages, ...event.response.messages];

        progress.traceMessages.push(...event.response.messages);

        await saveRunTrace({ runId, messages: progress.traceMessages });

        progress.messages = await policy.compact(progress.messages);
        progress.checkpointSequence += 1;

        await saveRunProgress({ runId, ...progress });
      },
    });

    const result = await agent.stream({
      messages: [...policy.messages],
      writable: getWritable<ModelCallStreamPart>(),
      preventClose: true,
      sendFinish: false,
    });

    const shouldContinue = CONTINUATION_FINISH_REASONS.has(result.finishReason);

    if ('error' in result || (result.finishReason !== 'stop' && !shouldContinue)) {
      return await failRun(runId);
    }

    try {
      await checkpointActivation({ runId, checkpointSequence: progress.checkpointSequence });
    } catch {
      return await failRun(runId, 'environment_checkpoint');
    }

    progress.checkpointSequence += 1;

    const outcome = await finishRun({ runId, ...progress, shouldContinue });

    await closeRunStream(outcome);

    return outcome;
  } catch {
    return await failRun(runId);
  }
}

function toolCompletionStatus({ output }: { readonly output: unknown }): 'completed' | 'not_started' {
  if (typeof output !== 'object' || output === null) {
    return 'completed';
  }

  if ('status' in output && output.status === 'not_started') {
    return 'not_started';
  }

  return 'completed';
}

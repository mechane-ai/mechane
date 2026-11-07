import { WorkflowAgent } from '@ai-sdk/workflow';
import type { ModelCallStreamPart } from '@ai-sdk/workflow';
import { createPresentationOutput, PresentationSpecification } from '@mechane/protocol/presentation';
import { stepCountIs, tool } from 'ai';
import { createHook, getWritable } from 'workflow';
import { deliverRunOutcomeToSlack, deliverRunToSlack } from '../channels/deliver-run-to-slack.ts';
import { prepareAgentContext } from '../models/context-policy.ts';
import { RuntimeModel } from '../models/runtime-model.ts';
import { createRequestTools } from '../requests/request-tools.ts';
import { prepareRuntimeTools } from '../tools/runtime-tools.ts';
import { admissionToken } from './admission-token.ts';
import { loadRunContext } from './run-context.ts';
import { runOutput } from './run-output.ts';
import { recordToolActivity, saveRunProgress } from './run-progress.ts';
import { claimRun, closeRunStream, failRun, finishRun, readTerminalRun } from './run-state.ts';
import type { RunOutcome } from './types.ts';

const MAXIMUM_AGENT_STEPS = 256;

export async function runWorkflow(runId: string): Promise<RunOutcome> {
  'use workflow';

  const outcome = await executeAdmission(runId);

  await deliverRunOutcomeToSlack(outcome);

  return outcome;
}

async function executeAdmission(runId: string): Promise<RunOutcome> {
  try {
    const hook = createHook<{ readonly runId: string }>({ token: admissionToken(runId) });

    await hook.getConflict();

    const state = { status: await claimRun(runId) };

    await deliverRunToSlack({ runId, kind: 'acknowledgement' });

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
    const prepared = await prepareRuntimeTools(context.identity);

    const tools = {
      ...prepared.tools,
      ...createRequestTools(context.identity),
      render_ui: tool({
        description:
          'Present a static card, table, or chart when a visual improves the answer. Supply the complete spec as tool arguments; keep the final reply in concise Markdown.',
        inputSchema: PresentationSpecification,
        execute: async (specification) => createPresentationOutput({ spec: specification }),
      }),
    };

    const instructions = [context.instructions, ...prepared.notices].join('\n\n');
    const reference = { ...context.identity, modelId: context.model };

    const policy = await prepareAgentContext({
      reference,
      instructions,
      messages: [...context.messages],
      historyMessageCount: context.messages.length - context.inputMessages.length,
    });

    const model = new RuntimeModel(reference);
    const progress = { messages: [...context.inputMessages] };

    const agent = new WorkflowAgent({
      model,
      instructions,
      tools,
      maxRetries: 0,
      maxOutputTokens: context.maxOutputTokens,
      stopWhen: stepCountIs(MAXIMUM_AGENT_STEPS),
      allowSystemInMessages: true,
      prepareStep: policy.prepareStep,
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
            status: 'completed',
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
        progress.messages.push(...event.response.messages);
        await saveRunProgress({ runId, messages: progress.messages });
      },
    });

    const result = await agent.stream({
      messages: policy.messages,
      writable: getWritable<ModelCallStreamPart>(),
      preventClose: true,
      sendFinish: false,
    });

    const additions = result.steps.flatMap((step) => step.response.messages);
    const output = runOutput(additions);

    if ('error' in result || result.finishReason === 'tool-calls' || output.reply.length === 0) {
      return await failRun(runId);
    }

    const outcome = await finishRun({
      runId,
      inputMessage: context.inputMessage,
      messages: [...context.inputMessages, ...additions],
      reply: output.reply,
    });

    await closeRunStream(outcome);

    return outcome;
  } catch {
    return await failRun(runId);
  }
}

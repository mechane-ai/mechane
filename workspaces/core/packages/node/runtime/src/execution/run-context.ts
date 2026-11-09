import { FatalError } from 'workflow';
import { loadRuntimeConfiguration } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import type { RunContext } from './types.ts';

const BASE_INSTRUCTIONS = [
  'You are a persistent agent with a durable home directory, identity, and working context.',
  'Notifications tell you about new events. Read them, decide what matters, and choose the appropriate actions.',
  'New notifications may arrive while you are working. Reconsider pending actions when they change the situation.',
  'Carry out the requested work using your tools. Verify outcomes before reporting success.',
  'Use the available commands and MCP tools to inspect your environment and do the work.',
  'Keep useful long-term notes and plans as files in your durable home. Never put credentials in notes, source files, or messages.',
  'Existing notes, when present, are preserved under ~/notes/imported/memory and ~/notes/imported/work. Inspect them when you need retained knowledge.',
  'A pending external request is not a reason to block other work. Record what you need and act on the later notification.',
  'An approval permits the next action; it is not evidence that the requested change is complete.',
  'Communicate only by explicitly calling the relevant tool. Use console_message to send a message to the Console.',
  'Your ordinary assistant text is private working context. It is never automatically sent to another person.',
  'When no further action is needed, you may finish quietly. You will wake when another notification arrives.',
].join('\n');

export async function loadRunContext(runId: string): Promise<RunContext> {
  'use step';

  const configuration = loadRuntimeConfiguration();

  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId });

    if (run === null || run.status !== 'running' || run.cancelRequestedAt !== null) {
      throw new FatalError('This run is no longer active.');
    }

    const revision = await store.getMechRevision({
      workspaceId: run.workspaceId,
      mechId: run.mechId,
      revision: run.definitionRevision,
    });

    if (revision === null) {
      throw new FatalError('The run definition is unavailable.');
    }

    const offer = configuration.model.offers.find((candidate) => candidate.id === revision.model);

    if (offer === undefined) {
      throw new FatalError('The selected model is unavailable.');
    }

    const context = await store.getMechContext({ runId });
    const instructions = [BASE_INSTRUCTIONS, revision.instructions ?? ''].join('\n\n');

    return {
      run,
      identity: { workspaceId: run.workspaceId, mechId: run.mechId, sessionId: run.sessionId, runId },
      messages: context.modelMessages,
      presentedSequence: context.presentedSequence,
      checkpointSequence: context.checkpointSequence,
      isEnvironmentCheckpointRequired: context.isEnvironmentCheckpointRequired,
      instructions,
      model: revision.model,
      maxOutputTokens: offer.maxOutputTokens,
    };
  });
}

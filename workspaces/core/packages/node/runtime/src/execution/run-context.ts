import { convertToModelMessages } from 'ai';
import { FatalError } from 'workflow';
import { hydrateSlackInput } from '../channels/hydrate-slack-input.ts';
import { loadRuntimeConfiguration } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import type { RunContext } from './types.ts';

const BASE_INSTRUCTIONS = [
  'You are a durable coding agent with a persistent identity and environment.',
  'Carry out the requested work using your tools. Verify outcomes before reporting success.',
  'Use bash with git, gh, nexus, and the available development tools. Choose the actions needed for the task.',
  'Keep useful long-term facts in memory. Never put credentials in memory, source files, or replies.',
  'If Nexus denies a capability, use request_access. The tool waits for the decision and resumes this same task.',
  'An approval permits the next action; it is not evidence that the requested change is complete.',
  'Use render_ui when a structured card, table, or chart makes the result easier to understand.',
  'Reply with concise Markdown and working links. The delivery adapter formats the reply for its destination.',
].join('\n');

export async function loadRunContext(runId: string): Promise<RunContext> {
  'use step';

  const inputMessage = await hydrateSlackInput({ runId });
  const inputMessages = await convertToModelMessages([inputMessage]);
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

    const history = await store.getSessionMessages({ sessionId: run.sessionId });
    const memories = await store.listMemories({ workspaceId: run.workspaceId, mechId: run.mechId });
    const memoryIndex = memories.map((memory) => `${memory.path} (version ${memory.version})`).join('\n');

    const instructions = [
      BASE_INSTRUCTIONS,
      revision.instructions ?? '',
      'Available memory documents:',
      memoryIndex,
    ].join('\n\n');

    return {
      run,
      identity: { workspaceId: run.workspaceId, mechId: run.mechId, sessionId: run.sessionId, runId },
      inputMessage,
      inputMessages,
      messages: [...history.modelMessages, ...inputMessages],
      instructions,
      model: revision.model,
      maxOutputTokens: offer.maxOutputTokens,
    };
  });
}

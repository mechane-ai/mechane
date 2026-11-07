import type { ModelCallStreamPart } from '@ai-sdk/workflow';
import { getRun } from 'workflow/api';
import type { RunOutcome } from './types.ts';

type CloseWorkflowStreamInput = { readonly workflowId: string; readonly errorMessage?: string };

type CloseOutcomeStreamInput = { readonly workflowId: string; readonly outcome: RunOutcome };

export async function closeOutcomeStream({ workflowId, outcome }: CloseOutcomeStreamInput): Promise<void> {
  if (outcome.status === 'failed') {
    await closeWorkflowStream({ workflowId, errorMessage: outcome.error });

    return;
  }

  await closeWorkflowStream({ workflowId });
}

export async function closeWorkflowStream({ workflowId, errorMessage }: CloseWorkflowStreamInput): Promise<void> {
  const writer = getRun(workflowId).getWritable<ModelCallStreamPart>().getWriter();

  try {
    if (errorMessage !== undefined) {
      await writer.write({ type: 'error', error: errorMessage });
    }

    await writer.close();
  } finally {
    writer.releaseLock();
  }
}

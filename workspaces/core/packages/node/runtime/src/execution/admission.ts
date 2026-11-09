import { EntityConflictError, HookConflictError } from '@workflow/errors';
import { getRun, resumeHook, start } from 'workflow/api';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { cancelRunExecutions } from '../tools/cancel-executions.ts';
import { admissionToken } from './admission-token.ts';
import { closeOutcomeStream, closeWorkflowStream } from './close-workflow-stream.ts';
import { stopActivation } from './stop-activation.ts';
import type { AdmissionInput, AdmissionResult, MechSelection, RunSelection } from './types.ts';

const ADMISSION_RETENTION = '30d';
const PRESERVED_CANCELLATION_OUTCOMES: ReadonlySet<string> = new Set(['completed', 'failed']);

export async function startAdmission({ runId, workflowDefinitionId }: AdmissionInput): Promise<AdmissionResult> {
  const recorded = await withRuntimeStore(async (store) => await store.getRun({ runId }));

  if (recorded === null) {
    throw new Error('Accepted run is unavailable');
  }

  if (recorded.workflowId !== null) {
    if (recorded.status === 'queued') {
      await resumeHook(admissionToken(recorded.id), { runId: recorded.id });
    }

    return { workflowId: recorded.workflowId };
  }

  const token = admissionToken(runId);
  const metadata = { workflowId: workflowDefinitionId };
  const workflowId = await startOnce();

  await withRuntimeStore(async (store) => await store.attachWorkflow({ runId, workflowId }));

  return { workflowId };

  async function startOnce(): Promise<string> {
    try {
      const run = await start(metadata, [runId], {
        experimental_hook: { token, experimental_minRetention: ADMISSION_RETENTION },
      });

      return run.runId;
    } catch (error) {
      if (HookConflictError.is(error) && error.conflictingRunId !== undefined) {
        return error.conflictingRunId;
      }

      throw error;
    }
  }
}

export async function wakeMech({ workspaceId, mechId }: MechSelection): Promise<void> {
  const next = await withRuntimeStore(async (store) => await store.reservePendingActivation({ workspaceId, mechId }));

  if (next === null || next.workflowId === null) {
    return;
  }

  await resumeHook(admissionToken(next.id), { runId: next.id });
}

type CancelWorkflowInput = RunSelection & { readonly cancelerId?: string };

export async function cancelWorkflow({ workspaceId, runId, cancelerId }: CancelWorkflowInput): Promise<void> {
  const run = await withRuntimeStore(async (store) => {
    if (cancelerId === undefined) {
      return await store.cancelRun({ workspaceId, runId });
    }

    return await store.cancelRun({ workspaceId, runId, cancelerId });
  });

  if (PRESERVED_CANCELLATION_OUTCOMES.has(run.status)) {
    return;
  }

  await cancelRunExecutions({ workspaceId, runId });

  let committed = run;

  if (run.status !== 'cancelled') {
    const result = await withRuntimeStore(async (store) => await stopActivation({ store, runId, status: 'cancelled' }));

    committed = result.run;
  }

  if (committed.status !== 'cancelled') {
    return;
  }

  if (committed.workflowId !== null) {
    await cancelNativeWorkflow(committed.workflowId);
    await closeWorkflowStream({ workflowId: committed.workflowId });
  }

  await wakeMech({ workspaceId, mechId: committed.mechId });
}

export async function failRunAndWake({ workflowId }: { readonly workflowId: string }): Promise<void> {
  const run = await withRuntimeStore(async (store) => await store.getRunByWorkflowId({ workflowId }));

  if (run === null || TERMINAL_WORKFLOW_STATES.has(run.status)) {
    return;
  }

  const {
    run: committed,
    outcome,
    wasFinished,
  } = await withRuntimeStore(
    async (store) =>
      await stopActivation({
        store,
        runId: run.id,
        status: 'failed',
        error: 'The runtime stopped before this run could finish.',
      }),
  );

  if (!wasFinished) {
    return;
  }

  await closeOutcomeStream({ workflowId, outcome });
  await wakeMech({ workspaceId: committed.workspaceId, mechId: committed.mechId });
}

const TERMINAL_WORKFLOW_STATES: ReadonlySet<string> = new Set(['completed', 'failed', 'cancelled']);

async function cancelNativeWorkflow(workflowId: string): Promise<void> {
  const workflow = getRun(workflowId);

  if (TERMINAL_WORKFLOW_STATES.has(await workflow.status)) {
    return;
  }

  try {
    await workflow.cancel();
  } catch (error) {
    if (EntityConflictError.is(error) && TERMINAL_WORKFLOW_STATES.has(await workflow.status)) {
      return;
    }

    throw error;
  }
}

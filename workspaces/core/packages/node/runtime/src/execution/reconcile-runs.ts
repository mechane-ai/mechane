import { getRun } from 'workflow/api';
import type { Run } from '../domain.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { cancelWorkflow, failRunAndWake, startAdmission, wakeMech } from './admission.ts';
import { stopActivation } from './stop-activation.ts';

type ReconcileRunsInput = { readonly workflowDefinitionId: string };
type RunCursor = { readonly createdAt: string; readonly id: string };
const RECONCILIATION_MAX_RUNS = 100;
const FINISHED_WORKFLOW_STATES: ReadonlySet<string> = new Set(['failed', 'completed']);

export async function reconcileRuns({ workflowDefinitionId }: ReconcileRunsInput): Promise<void> {
  await reconcilePendingMechs(workflowDefinitionId);

  let page = await readUnfinishedPage();

  while (page.length > 0) {
    await reconcilePage(page, workflowDefinitionId);

    const last = page.at(-1);

    if (last === undefined || page.length < RECONCILIATION_MAX_RUNS) {
      return;
    }

    page = await readUnfinishedPage({ createdAt: last.createdAt, id: last.id });
  }
}

async function reconcilePendingMechs(workflowDefinitionId: string): Promise<void> {
  const pending = await withRuntimeStore(
    async (store) => await store.listPendingMechs({ maxRows: RECONCILIATION_MAX_RUNS }),
  );

  for (const mech of pending) {
    try {
      const run = await withRuntimeStore(async (store) => await store.reservePendingActivation(mech));

      if (run !== null) {
        await startAdmission({ runId: run.id, workflowDefinitionId });
      }
    } catch (error) {
      console.error('mechane.reconciliation.failed', {
        phase: 'wake',
        workspaceId: mech.workspaceId,
        mechId: mech.mechId,
        errorType: reconciliationErrorType({ error }),
      });
    }
  }
}

async function readUnfinishedPage(after?: RunCursor): Promise<ReadonlyArray<Run>> {
  return await withRuntimeStore(async (store) => {
    if (after === undefined) {
      return await store.listUnfinishedRuns({ maxRuns: RECONCILIATION_MAX_RUNS });
    }

    return await store.listUnfinishedRuns({ maxRuns: RECONCILIATION_MAX_RUNS, after });
  });
}

async function reconcilePage(page: ReadonlyArray<Run>, workflowDefinitionId: string): Promise<void> {
  for (const run of page) {
    try {
      await reconcileRun(run, workflowDefinitionId);
    } catch (error) {
      console.error('mechane.reconciliation.failed', {
        phase: 'activation',
        workspaceId: run.workspaceId,
        mechId: run.mechId,
        runId: run.id,
        errorType: reconciliationErrorType({ error }),
      });
    }
  }
}

function reconciliationErrorType({ error }: { readonly error: unknown }): string {
  if (error instanceof Error) {
    return error.name;
  }

  return typeof error;
}

async function reconcileRun(run: Run, workflowDefinitionId: string): Promise<void> {
  if (run.cancelRequestedAt !== null) {
    await cancelWorkflow({ workspaceId: run.workspaceId, runId: run.id });

    return;
  }

  if (run.workflowId === null) {
    await startAdmission({ runId: run.id, workflowDefinitionId });

    return;
  }

  const workflow = getRun(run.workflowId);

  if (!(await workflow.exists)) {
    const { run: committed } = await withRuntimeStore(
      async (store) =>
        await stopActivation({
          store,
          runId: run.id,
          status: 'failed',
          error: 'The durable workflow state is unavailable. Inspect external effects before retrying.',
        }),
    );

    await wakeMech({ workspaceId: committed.workspaceId, mechId: committed.mechId });

    return;
  }

  const status = await workflow.status;

  if (status === 'cancelled') {
    await cancelWorkflow({ workspaceId: run.workspaceId, runId: run.id });

    return;
  }

  if (FINISHED_WORKFLOW_STATES.has(status)) {
    await failRunAndWake({ workflowId: run.workflowId });

    return;
  }

  if (run.status === 'queued') {
    await wakeMech({ workspaceId: run.workspaceId, mechId: run.mechId });
  }
}

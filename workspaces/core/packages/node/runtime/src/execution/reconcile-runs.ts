import { getRun } from 'workflow/api';
import { deliverRunOutcomeToSlack } from '../channels/deliver-run-to-slack.ts';
import type { Run } from '../domain.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { cancelWorkflow, failRunAndWake, startAdmission, wakeMech } from './admission.ts';
import { readTerminalOutcome } from './terminal-outcome.ts';

type ReconcileRunsInput = { readonly workflowDefinitionId: string };
type RunCursor = { readonly createdAt: string; readonly id: string };
const RECONCILIATION_MAX_RUNS = 100;
const FINISHED_WORKFLOW_STATES: ReadonlySet<string> = new Set(['failed', 'completed']);

export async function reconcileRuns({ workflowDefinitionId }: ReconcileRunsInput): Promise<void> {
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
    await reconcileRun(run, workflowDefinitionId);
  }
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
    const { committed, outcome } = await withRuntimeStore(async (store) => {
      const terminal = await store.finishRun({
        runId: run.id,
        status: 'failed',
        reply: null,
        error: 'The durable workflow state is unavailable. Inspect external effects before retrying.',
      });

      return { committed: terminal, outcome: await readTerminalOutcome({ store, run: terminal }) };
    });

    await wakeMech({ workspaceId: committed.workspaceId, mechId: committed.mechId });
    await deliverRunOutcomeToSlack(outcome);

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

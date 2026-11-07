import { Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import type { ExecutionReceipt } from '../domain.ts';
import type { StoreContext } from './context.ts';
import { AdmissionRefused, RecordNotFound, StoreConflict } from './errors.ts';
import { withRunMutation } from './run-mutations.ts';
import { advanceRunVersion } from './run-version.ts';

const ReceiptRow = Schema.Struct({
  id: Schema.String,
  run_id: Schema.String,
  kind: Schema.Literals(['sandbox', 'mcp', 'process', 'browser']),
  request: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  status: Schema.Literals(['pending', 'running', 'completed', 'uncertain', 'failed']),
  provider_id: Schema.NullOr(Schema.String),
  result: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  created_at: Schema.String,
  updated_at: Schema.String,
});

const TERMINAL_STATES: ReadonlySet<ExecutionReceipt['status']> = new Set(['completed', 'failed']);

type BeginExecutionInput = { readonly id: string; readonly runId: string } & (
  | { readonly kind: 'process' | 'browser'; readonly request: Readonly<Record<string, unknown>> }
  | { readonly kind: 'sandbox' | 'mcp'; readonly request?: never }
);

type ExecutionAdmission = { readonly receipt: ExecutionReceipt; readonly wasCreated: boolean };
type GetExecutionInput = { readonly id: string; readonly workspaceId: string; readonly mechId: string };
type ListRunExecutionsInput = { readonly runId: string; readonly workspaceId: string };
type ScopedExecutionReceipt = ExecutionReceipt & { readonly mechId: string };

type FinishExecutionInput = {
  readonly id: string;
  readonly status: ExecutionReceipt['status'];
  readonly providerId: string | null;
  readonly result: Readonly<Record<string, unknown>> | null;
};

function readReceipt(value: unknown): ExecutionReceipt {
  const row = Schema.decodeUnknownSync(ReceiptRow)(value);

  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    request: row.request,
    status: row.status,
    providerId: row.provider_id,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function checkTransition(current: ExecutionReceipt, input: FinishExecutionInput): void {
  if (current.providerId !== null && input.providerId !== null && current.providerId !== input.providerId) {
    throw new StoreConflict('Execution provider identity changed');
  }

  if (TERMINAL_STATES.has(current.status)) {
    const hasChangedProvider = input.providerId !== null && input.providerId !== current.providerId;

    if (current.status !== input.status || hasChangedProvider || !isDeepStrictEqual(current.result, input.result)) {
      throw new StoreConflict('Execution outcome is already final');
    }

    return;
  }

  if (current.status !== 'pending' && input.status === 'pending') {
    throw new StoreConflict('Execution cannot return to pending');
  }
}

export function createExecutionReceiptStore(context: StoreContext) {
  return {
    beginExecution: async (input: BeginExecutionInput): Promise<ExecutionAdmission> => {
      const { id, runId, kind } = input;
      const request = input.request ?? null;

      return await withRunMutation({
        context,
        scope: input,
        mutation: async ({ client }) => {
          const created = await client.query(
            `INSERT INTO mechane.execution_receipts(id,run_id,kind,status,request)
           SELECT $1,id,$3,'pending',$4 FROM mechane.runs WHERE id=$2 AND status='running' AND cancel_requested_at IS NULL
           ON CONFLICT(id) DO NOTHING RETURNING *`,
            [id, runId, kind, request],
          );

          if (created.rows.length > 0) {
            await advanceRunVersion({ client, runId });

            return { receipt: readReceipt(created.rows[0]), wasCreated: true };
          }

          const existing = await client.query('SELECT * FROM mechane.execution_receipts WHERE id=$1', [id]);

          if (existing.rows.length === 0) {
            throw new AdmissionRefused('Run cannot start an execution');
          }

          const receipt = readReceipt(existing.rows[0]);

          if (receipt.runId !== runId || receipt.kind !== kind) {
            throw new StoreConflict('Execution belongs to another run');
          }

          if (!isDeepStrictEqual(receipt.request, request)) {
            throw new StoreConflict('Execution request is already bound to another payload');
          }

          return { receipt, wasCreated: false };
        },
      });
    },
    listRunExecutions: async ({
      runId,
      workspaceId,
    }: ListRunExecutionsInput): Promise<ReadonlyArray<ScopedExecutionReceipt>> => {
      const found = await context.client.query(
        `SELECT e.*,r.mech_id FROM mechane.execution_receipts e JOIN mechane.runs r ON r.id=e.run_id
         WHERE r.id=$1 AND r.workspace_id=$2 ORDER BY e.created_at,e.id`,
        [runId, workspaceId],
      );

      return found.rows.map((value: unknown) => {
        const receipt = readReceipt(value);
        const scope = Schema.decodeUnknownSync(Schema.Struct({ mech_id: Schema.String }))(value);

        return { ...receipt, mechId: scope.mech_id };
      });
    },
    getExecution: async ({ id, workspaceId, mechId }: GetExecutionInput): Promise<ExecutionReceipt | null> => {
      const found = await context.client.query(
        `SELECT e.* FROM mechane.execution_receipts e
         JOIN mechane.runs r ON r.id=e.run_id
         WHERE e.id=$1 AND r.workspace_id=$2 AND r.mech_id=$3`,
        [id, workspaceId, mechId],
      );

      if (found.rows.length === 0) {
        return null;
      }

      return readReceipt(found.rows[0]);
    },
    finishExecution: async (input: FinishExecutionInput): Promise<ExecutionReceipt> =>
      await context.atomic(async ({ client }) => {
        await client.query(
          `SELECT r.id FROM mechane.runs r JOIN mechane.execution_receipts e ON e.run_id=r.id
           WHERE e.id=$1 FOR UPDATE OF r`,
          [input.id],
        );

        const found = await client.query('SELECT * FROM mechane.execution_receipts WHERE id=$1 FOR UPDATE', [input.id]);

        if (found.rows.length === 0) {
          throw new RecordNotFound('Execution receipt was not found');
        }

        const current = readReceipt(found.rows[0]);

        checkTransition(current, input);

        if (TERMINAL_STATES.has(current.status)) {
          return current;
        }

        const hasSameProvider = input.providerId === null || input.providerId === current.providerId;

        if (current.status === input.status && hasSameProvider && isDeepStrictEqual(current.result, input.result)) {
          return current;
        }

        const saved = await client.query(
          `UPDATE mechane.execution_receipts
           SET status=$2,provider_id=COALESCE(provider_id,$3),result=$4,updated_at=now()
           WHERE id=$1 RETURNING *`,
          [input.id, input.status, input.providerId, input.result],
        );

        await advanceRunVersion({ client, runId: current.runId });

        return readReceipt(saved.rows[0]);
      }),
  };
}

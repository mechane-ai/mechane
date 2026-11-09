import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { ConsoleMessage, Run } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { AdmissionRefused, StoreConflict } from '../errors.ts';
import { createActivityStore } from '../execution/activity.ts';
import { lockActivation, readMailbox } from './locking.ts';
import type { MechScope } from './locking.ts';
import { decodeConsoleMessage, requireSequence } from './rows.ts';

type ToolAdmission =
  | { readonly status: 'admitted'; readonly reason?: never }
  | { readonly status: 'not_started'; readonly reason: 'notifications_pending' | 'execution_stopped' };

type AdmitToolDispatch = {
  readonly runId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly presentedSequence: number;
};

type PublishConsoleMessage = {
  readonly runId: string;
  readonly toolCallId: string;
  readonly text: string;
  readonly presentation?: Readonly<Record<string, unknown>>;
};

type ListConsoleMessages = MechScope & {
  readonly beforeSequence?: number;
  readonly afterSequence?: number;
  readonly maxRows?: number;
};

const DEFAULT_CONSOLE_MESSAGES = 50;
const MAXIMUM_CONSOLE_MESSAGES = 200;

const DispatchRow = Schema.Struct({
  status: Schema.Literals(['admitted', 'not_started']),
  reason: Schema.NullOr(Schema.Literals(['notifications_pending', 'execution_stopped'])),
  presented_sequence: Schema.Number,
  tool_name: Schema.String,
});

function decision(row: typeof DispatchRow.Type): ToolAdmission {
  if (row.status === 'admitted') {
    return { status: 'admitted' };
  }

  if (row.reason === null) {
    throw new StoreConflict('Tool admission reason is missing');
  }

  return { status: 'not_started', reason: row.reason };
}

async function isExecutionActive(context: StoreContext, run: Run): Promise<boolean> {
  if (run.status !== 'running' || run.cancelRequestedAt !== null) {
    return false;
  }

  const result = await context.client.query(
    `SELECT mech.id FROM mechane.mechs mech JOIN mechane.workspaces workspace ON workspace.id=mech.workspace_id
     JOIN mechane.mech_mailboxes mailbox ON mailbox.mech_id=mech.id
     WHERE mech.id=$1 AND mech.status='active' AND mailbox.active_run_id=$2 AND NOT mailbox.is_environment_checkpoint_required
       AND NOT COALESCE((workspace.policy->>'isSuspended')::boolean,false)`,
    [run.mechId, run.id],
  );

  return result.rows.length === 1;
}

export function createNotificationToolStore(context: StoreContext) {
  return {
    admitToolDispatch: async (input: AdmitToolDispatch): Promise<ToolAdmission> => {
      requireSequence(input.presentedSequence);

      return await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, input.runId);

        const saved = await transaction.client.query(
          'SELECT * FROM mechane.tool_dispatches WHERE run_id=$1 AND tool_call_id=$2',
          [input.runId, input.toolCallId],
        );

        if (saved.rows.length > 0) {
          const prior = Schema.decodeUnknownSync(DispatchRow)(saved.rows[0]);

          if (prior.presented_sequence !== input.presentedSequence || prior.tool_name !== input.toolName) {
            throw new StoreConflict('Tool admission identity changed');
          }

          return decision(prior);
        }

        const mailbox = await readMailbox(transaction, run.mechId);
        let admission: ToolAdmission = { status: 'admitted' };

        if (!(await isExecutionActive(transaction, run))) {
          admission = { status: 'not_started', reason: 'execution_stopped' };
        } else if (mailbox.received_sequence > input.presentedSequence) {
          admission = { status: 'not_started', reason: 'notifications_pending' };
        } else if (mailbox.presented_sequence !== input.presentedSequence) {
          throw new StoreConflict('Tool dispatch does not match the persisted context');
        }

        await transaction.client.query(
          `INSERT INTO mechane.tool_dispatches(run_id,tool_call_id,presented_sequence,status,reason,tool_name) VALUES($1,$2,$3,$4,$5,$6)`,
          [
            input.runId,
            input.toolCallId,
            input.presentedSequence,
            admission.status,
            admission.reason ?? null,
            input.toolName,
          ],
        );

        return admission;
      });
    },
    publishConsoleMessage: async (input: PublishConsoleMessage): Promise<ConsoleMessage> =>
      await context.atomic(async (transaction) => {
        const run = await lockActivation(transaction, input.runId);

        const existing = await transaction.client.query(
          'SELECT * FROM mechane.console_messages WHERE run_id=$1 AND tool_call_id=$2',
          [input.runId, input.toolCallId],
        );

        if (existing.rows.length > 0) {
          const prior = decodeConsoleMessage(existing.rows[0]);

          if (prior.text !== input.text || !isDeepStrictEqual(prior.presentation, input.presentation ?? null)) {
            throw new StoreConflict('Console publication identity changed');
          }

          return prior;
        }

        const admitted = await transaction.client.query(
          `SELECT tool_call_id FROM mechane.tool_dispatches
           WHERE run_id=$1 AND tool_call_id=$2 AND tool_name='console_message' AND status='admitted'`,
          [input.runId, input.toolCallId],
        );

        if (admitted.rows.length === 0 || !(await isExecutionActive(transaction, run))) {
          throw new AdmissionRefused('Console publication was not admitted');
        }

        if (input.text.trim().length === 0) {
          throw new StoreConflict('Console message is empty');
        }

        const saved = await transaction.client.query(
          `INSERT INTO mechane.console_messages(id,workspace_id,mech_id,run_id,tool_call_id,role,text,presentation)
           VALUES($1,$2,$3,$4,$5,'assistant',$6,$7) RETURNING *`,
          [randomUUID(), run.workspaceId, run.mechId, run.id, input.toolCallId, input.text, input.presentation ?? null],
        );

        const message = decodeConsoleMessage(saved.rows[0]);

        await createActivityStore(transaction).appendActivity({
          id: randomUUID(),
          workspaceId: run.workspaceId,
          mechId: run.mechId,
          runId: run.id,
          type: 'console.message',
          payload: { messageId: message.id, turnId: run.id },
        });

        return message;
      }),
    listConsoleMessages: async (input: ListConsoleMessages) => {
      const maxRows = input.maxRows ?? DEFAULT_CONSOLE_MESSAGES;

      if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAXIMUM_CONSOLE_MESSAGES) {
        throw new StoreConflict('Console message page size is invalid');
      }

      if (input.beforeSequence !== undefined && input.afterSequence !== undefined) {
        throw new StoreConflict('Console message cursors cannot be combined');
      }

      const isNewestFirst = input.afterSequence === undefined;

      const result = await context.client.query(
        `SELECT * FROM mechane.console_messages WHERE workspace_id=$1 AND mech_id=$2
         AND ($3::bigint IS NULL OR sequence<$3) AND ($4::bigint IS NULL OR sequence>$4)
         ORDER BY CASE WHEN $6::boolean THEN sequence END DESC,
           CASE WHEN NOT $6::boolean THEN sequence END ASC LIMIT $5`,
        [
          input.workspaceId,
          input.mechId,
          input.beforeSequence ?? null,
          input.afterSequence ?? null,
          maxRows + 1,
          isNewestFirst,
        ],
      );

      const page = result.rows.slice(0, maxRows).map(decodeConsoleMessage);
      let messages = page;

      if (isNewestFirst) {
        messages = page.toReversed();
      }

      const hasMore = result.rows.length > maxRows;
      let beforeSequence = messages[0]?.sequence ?? null;

      if (!hasMore) {
        beforeSequence = null;
      }

      return { messages, hasMore, beforeSequence };
    },
  };
}

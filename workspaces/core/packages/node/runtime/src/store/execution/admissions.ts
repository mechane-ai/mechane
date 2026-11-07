import type { UIMessage } from 'ai';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { InputAdmission, InputAttachment, InputOrigin, Session } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { AdmissionRefused, RecordNotFound, StoreConflict } from '../errors.ts';
import { createActivityStore } from './activity.ts';
import { createExecutionReads } from './reads.ts';
import { decodeSession, decodeUiMessages, InputAttachmentsSchema, InputOriginSchema } from './rows.ts';

export type EnsureSessionInput = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly key: string;
  readonly source: Session['source'];
  readonly title?: string;
};

export type AdmitInput = {
  readonly id: string;
  readonly runId: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly idempotencyKey: string;
  readonly inputText: string;
  readonly inputMessage: UIMessage;
  readonly origin: InputOrigin;
  readonly attachments?: ReadonlyArray<InputAttachment>;
};

const MechAdmissionSchema = Schema.Struct({
  revision: Schema.Number,
  status: Schema.String,
  is_suspended: Schema.Boolean,
});

const PriorAdmissionSchema = Schema.Struct({ id: Schema.String, isMatching: Schema.Boolean });
const SESSION_TITLE_LENGTH = 80;

async function requireInputAuthority(context: StoreContext, input: AdmitInput): Promise<void> {
  if (input.origin.kind !== 'slack') {
    const membership = await context.client.query(
      `
      SELECT principal_id FROM mechane.memberships
      WHERE workspace_id=$1 AND principal_id=$2 FOR SHARE`,
      [input.workspaceId, input.origin.principalId],
    );

    if (membership.rows.length === 0) {
      throw new AdmissionRefused('Workspace membership is required');
    }

    return;
  }

  const origin = input.origin;

  const binding = await context.client.query(
    `
    SELECT b.id FROM mechane.slack_bindings b
    JOIN mechane.slack_installations s ON s.id=b.installation_id AND s.workspace_id=b.workspace_id
    WHERE b.id=$1 AND b.workspace_id=$2 AND b.mech_id=$3 AND b.installation_id=$4
      AND b.team_id=$5 AND b.channel_id=$6 AND s.team_id=$5 AND s.deleted_at IS NULL
      AND b.is_listening AND (b.allowed_user_ids IS NULL OR $7=ANY(b.allowed_user_ids))
    FOR SHARE OF b,s`,
    [
      origin.bindingId,
      input.workspaceId,
      input.mechId,
      origin.installationId,
      origin.teamId,
      origin.channelId,
      origin.userId,
    ],
  );

  if (binding.rows.length === 0) {
    throw new AdmissionRefused('Slack binding does not admit this message');
  }
}

function inboxActivity(input: AdmitInput): Readonly<Record<string, unknown>> {
  const base = { inboxItemId: input.id, text: input.inputText, delivery: 'when_idle' };

  if (input.origin.kind === 'slack') {
    return {
      ...base,
      senderId: null,
      source: {
        channelId: input.origin.channelId,
        teamId: input.origin.teamId,
        messageTimestamp: input.origin.messageId,
        userId: input.origin.userId,
      },
    };
  }

  return { ...base, senderId: input.origin.principalId };
}

export function createAdmissionStore(context: StoreContext) {
  return {
    ensureSession: async ({
      workspaceId,
      mechId,
      key,
      source,
      title = 'Conversation',
    }: EnsureSessionInput): Promise<Session> => {
      const rows = await context.client.query(
        `
        INSERT INTO mechane.sessions(id,workspace_id,mech_id,channel_key,source,title)
        SELECT $1,workspace_id,id,$4,$5,$6 FROM mechane.mechs WHERE workspace_id=$2 AND id=$3
        ON CONFLICT(workspace_id,mech_id,channel_key) DO UPDATE SET channel_key=excluded.channel_key
        RETURNING *`,
        [randomUUID(), workspaceId, mechId, key, source, title],
      );

      if (rows.rows.length === 0) {
        throw new RecordNotFound('Mech was not found');
      }

      const session = decodeSession(rows.rows[0]);

      if (session.source !== source) {
        throw new StoreConflict('Session source changed');
      }

      return session;
    },
    admitInput: async (input: AdmitInput): Promise<InputAdmission> => {
      const messages = await decodeUiMessages([input.inputMessage]);
      const inputMessage = messages[0];

      if (inputMessage === undefined || inputMessage.role !== 'user') {
        throw new AdmissionRefused('Input must be one user message');
      }

      const origin = Schema.decodeUnknownSync(InputOriginSchema)(input.origin);
      const attachments = Schema.decodeUnknownSync(InputAttachmentsSchema)(input.attachments ?? []);

      return await context.atomic(async (transaction) => {
        const { client } = transaction;

        await client.query('SELECT id FROM mechane.workspaces WHERE id=$1 FOR UPDATE', [input.workspaceId]);

        const mechs = await client.query(
          `
          SELECT m.revision,m.status,COALESCE((w.policy->>'isSuspended')::boolean,false) AS is_suspended
          FROM mechane.mechs m JOIN mechane.workspaces w ON w.id=m.workspace_id
          WHERE m.workspace_id=$1 AND m.id=$2 FOR UPDATE OF m`,
          [input.workspaceId, input.mechId],
        );

        if (mechs.rows.length === 0) {
          throw new RecordNotFound('Mech was not found');
        }

        await requireInputAuthority(transaction, input);

        const reads = createExecutionReads(transaction);

        const previous = await client.query(
          `
          SELECT r.id,(i.session_id=$4 AND i.input_text=$5 AND i.input_message=$6::jsonb
            AND i.origin=$7::jsonb AND i.attachments=$8::jsonb) AS "isMatching"
          FROM mechane.inputs i JOIN mechane.runs r ON r.input_id=i.id
          WHERE i.workspace_id=$1 AND i.mech_id=$2 AND i.idempotency_key=$3`,
          [
            input.workspaceId,
            input.mechId,
            input.idempotencyKey,
            input.sessionId,
            input.inputText,
            inputMessage,
            origin,
            JSON.stringify(attachments),
          ],
        );

        if (previous.rows.length > 0) {
          const prior = Schema.decodeUnknownSync(PriorAdmissionSchema)(previous.rows[0]);

          if (!prior.isMatching) {
            throw new StoreConflict('Input idempotency key was reused with different content');
          }

          const run = await reads.getRun({ runId: prior.id });

          if (run === null) {
            throw new StoreConflict('Accepted input has no run');
          }

          return { run, wasCreated: false };
        }

        const mech = Schema.decodeUnknownSync(MechAdmissionSchema)(mechs.rows[0]);

        if (mech.status === 'archived' || mech.is_suspended) {
          throw new AdmissionRefused('Mech is not accepting inputs');
        }

        const sessions = await client.query(
          `
          SELECT id FROM mechane.sessions WHERE id=$1 AND workspace_id=$2 AND mech_id=$3`,
          [input.sessionId, input.workspaceId, input.mechId],
        );

        if (sessions.rows.length === 0) {
          throw new RecordNotFound('Session was not found');
        }

        await client.query(
          `
          INSERT INTO mechane.inputs(id,workspace_id,mech_id,session_id,idempotency_key,input_text,input_message,origin,attachments)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            input.id,
            input.workspaceId,
            input.mechId,
            input.sessionId,
            input.idempotencyKey,
            input.inputText,
            inputMessage,
            origin,
            JSON.stringify(attachments),
          ],
        );
        await client.query(
          `
          INSERT INTO mechane.runs(id,workspace_id,mech_id,session_id,input_id,definition_revision,status)
          VALUES($1,$2,$3,$4,$5,$6,'queued')`,
          [input.runId, input.workspaceId, input.mechId, input.sessionId, input.id, mech.revision],
        );
        await client.query(
          `
          UPDATE mechane.sessions SET updated_at=now(),
            title=CASE WHEN title='Conversation' AND length(trim($2))>0 THEN $2 ELSE title END WHERE id=$1`,
          [input.sessionId, input.inputText.slice(0, SESSION_TITLE_LENGTH)],
        );
        await createActivityStore(transaction).appendActivity({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: input.runId,
          type: 'inbox_item.received',
          payload: inboxActivity(input),
        });

        const run = await reads.getRun({ runId: input.runId });

        if (run === null) {
          throw new StoreConflict('Accepted input has no run');
        }

        return { run, wasCreated: true };
      });
    },
  };
}

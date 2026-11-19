import { HttpStatusCode, RecordId } from '@mechane/records';
import { Schema } from 'effect';
import type { CredentialKeyring } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { ManagedStoreError } from './managed-record.ts';
import { sessionAssertionContext } from './session-assertion.ts';
import { createSession } from './session-create.ts';
import { listSessions } from './session-list.ts';
import type { SessionQuery } from './session-list.ts';
import { applySessionMutation } from './session-mutations.ts';
import type { MutationInput } from './session-mutations.ts';
import { openDescriptor, readSession, sessionDocument } from './session-records.ts';
import type { SessionIdentity, SessionStatus } from './session-records.ts';
import type { ManagedDocument, ManagedScope } from './types.ts';
import { closeSessionWork } from './work-records.ts';

const PENDING_OPEN_MAX_ROWS = 100;
const PendingIdentity = Schema.Struct({ workspace_id: RecordId, creator_id: RecordId, id: StoredText });

type Projection = {
  readonly workspaceId: string;
  readonly id: string;
  readonly sequence: number;
  readonly status: SessionStatus;
  readonly updatedAt: string;
  readonly outcomeEvaluations?: ReadonlyArray<ManagedDocument>;
};

type PendingPage = Pick<Required<SessionQuery>, 'maxRows'>;

async function projectStatus(context: StoreContext, input: Projection): Promise<boolean> {
  const { workspaceId, id, sequence, status, updatedAt, outcomeEvaluations } = input;

  const result = await context.client.query(
    `UPDATE mechane.managed_sessions SET status_sequence=$3,
       outcome_evaluations=COALESCE($6::jsonb,outcome_evaluations),updated_at=GREATEST(updated_at,$5),
       status_at=CASE WHEN status=$4 THEN status_at ELSE GREATEST(status_at,$5::timestamptz) END,status=$4
     WHERE workspace_id=$1 AND id=$2 AND status_sequence<$3 AND (status<>'terminated' OR $4='terminated')`,
    [workspaceId, id, sequence, status, updatedAt, JSON.stringify(outcomeEvaluations)],
  );

  return result.rowCount === 1;
}

export function createManagedSessionStore(context: StoreContext, keyring: CredentialKeyring) {
  return {
    assertionContext: (scope: Parameters<typeof sessionAssertionContext>[1]) => sessionAssertionContext(context, scope),
    applyMutation: (input: MutationInput) => context.atomic((transaction) => applySessionMutation(transaction, input)),
    create: (input: Parameters<typeof createSession>[2]) =>
      context.atomic((transaction) => createSession(transaction, keyring, input)),
    get: async (identity: SessionIdentity) => await sessionDocument(context, await readSession(context, identity)),
    list: (input: { readonly scope: ManagedScope; readonly query?: SessionQuery }) => listSessions(context, input),
    async visibleIds({
      scope,
      ids,
    }: {
      readonly scope: ManagedScope;
      readonly ids: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<string>> {
      if (ids.length === 0) {
        return [];
      }

      const result = await context.client.query(
        'SELECT id FROM mechane.managed_sessions WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean) AND id=ANY($4::text[])',
        [scope.workspaceId, scope.principalId, scope.isAdmin, ids],
      );

      return Schema.decodeUnknownSync(Schema.Array(Schema.Struct({ id: StoredText })))(result.rows).map(
        (row) => row.id,
      );
    },
    async runtimeBinding(identity: SessionIdentity) {
      const row = await readSession(context, identity);

      return {
        agentId: row.agent_id,
        environmentId: row.environment_id,
        pendingOpen: await openDescriptor(context, row),
      };
    },
    async confirmOpen({ scope, id }: SessionIdentity) {
      await context.client.query(
        'UPDATE mechane.managed_sessions SET initial_events=NULL WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean) AND id=$4 AND initial_events IS NOT NULL',
        [scope.workspaceId, scope.principalId, scope.isAdmin, id],
      );
    },
    async listPendingOpen({ maxRows: limit }: PendingPage) {
      if (!Number.isInteger(limit) || limit < 1 || limit > PENDING_OPEN_MAX_ROWS) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid pending session limit');
      }

      const result = await context.client.query(
        `WITH pending AS (
           SELECT id FROM mechane.managed_sessions WHERE initial_events IS NOT NULL AND archived_at IS NULL
           ORDER BY last_open_attempt_at NULLS FIRST,created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED
         ) UPDATE mechane.managed_sessions s SET last_open_attempt_at=now() FROM pending p WHERE s.id=p.id
           RETURNING s.id,s.workspace_id,s.creator_id`,
        [limit],
      );

      return Schema.decodeUnknownSync(Schema.Array(PendingIdentity))(result.rows).map((row) => ({
        id: row.id,
        scope: { workspaceId: row.workspace_id, principalId: row.creator_id, isAdmin: false },
      }));
    },
    async project(input: Projection): Promise<void> {
      if (input.status !== 'terminated') {
        await projectStatus(context, input);

        return;
      }

      await context.atomic(async (transaction) => {
        const applied = await projectStatus(transaction, input);

        if (applied) {
          await closeSessionWork(transaction, { workspaceId: input.workspaceId, sessionId: input.id });
        }
      });
    },
  };
}

import {
  MechBusy,
  MechCreationConflict,
  MechNotFound,
  MechRevisionConflict,
  RequestInvalid,
  WorkspaceNotFound,
} from '@mechane/protocol';
import { CreationRequestRecordId, MechId } from '@mechane/records';
import { Record, Schema } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import type { Mech, MechDefinition, MechRevision } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { pageFromRows } from '../page.ts';
import type { Page } from '../page.ts';
import {
  forkNotificationPayload,
  forkNotifications,
  forkNotificationState,
  mappedForkId,
} from './fork-notifications.ts';

export type MechScope = { readonly workspaceId: string; readonly mechId: string };
export type MechPageInput = { readonly workspaceId: string; readonly after: string | null; readonly maxRows: number };

export type CreateMechInput = {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly requestId: string;
  readonly definition: MechDefinition;
};

export type UpdateMechInput = MechScope & {
  readonly principalId: string;
  readonly expectedRevision: number;
  readonly changes: Partial<MechDefinition>;
};

export type MechRevisionsInput = MechScope & { readonly after: number; readonly maxRows: number };
export type MechRevisionInput = MechScope & { readonly revision: number };

export type CloneMechInput = MechScope & {
  readonly principalId: string;
  readonly name: string;
  readonly requestId: string;
};

type StoredMech = Mech & { readonly creationFingerprint: string };

async function getMech(context: StoreContext, scope: MechScope): Promise<Mech> {
  const result = await context.client.query<StoredMech>(
    `SELECT id, workspace_id AS "workspaceId", name, model, instructions,
  daily_cap_micros AS "dailyCapMicros", status, revision, creator_id AS "creatorId",
  updater_id AS "updaterId", created_at AS "createdAt", updated_at AS "updatedAt",
  forked_from AS "forkedFrom", creation_fingerprint AS "creationFingerprint" FROM mechane.mechs WHERE workspace_id = $1 AND id = $2`,
    [scope.workspaceId, scope.mechId],
  );

  const mech = result.rows[0];

  if (mech === undefined) {
    throw new MechNotFound({ mechId: scope.mechId });
  }

  return mech;
}

async function saveRevision(context: StoreContext, mechId: string): Promise<void> {
  await context.client.query(
    `INSERT INTO mechane.mech_revisions
      (mech_id, revision, name, model, instructions, daily_cap_micros, status, updater_id, updated_at)
     SELECT id, revision, name, model, instructions, daily_cap_micros, status, updater_id, updated_at
     FROM mechane.mechs WHERE id = $1`,
    [mechId],
  );
}

async function lockMember(context: StoreContext, workspaceId: string, principalId: string): Promise<void> {
  const membership = await context.client.query(
    'SELECT principal_id FROM mechane.memberships WHERE workspace_id=$1 AND principal_id=$2 FOR SHARE',
    [workspaceId, principalId],
  );

  if (membership.rowCount === 0) {
    throw new WorkspaceNotFound({ workspaceId });
  }
}

function creationFingerprint(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function createMech(context: StoreContext, input: CreateMechInput, requestFingerprint?: string): Promise<Mech> {
  return await context.atomic(async (transaction) => {
    await transaction.client.query('SELECT id FROM mechane.workspaces WHERE id = $1 FOR UPDATE', [input.workspaceId]);
    await lockMember(transaction, input.workspaceId, input.principalId);

    const fingerprint =
      requestFingerprint ?? creationFingerprint({ principalId: input.principalId, ...input.definition });

    const existing = await findCreatedMech(transaction, {
      workspaceId: input.workspaceId,
      requestId: input.requestId,
      fingerprint,
    });

    if (existing !== undefined) {
      return existing;
    }

    const mechId = randomUUID();
    const definition = input.definition;

    await transaction.client.query(
      `INSERT INTO mechane.mechs
        (id, workspace_id, name, model, instructions, daily_cap_micros, status, revision,
         creation_request_id, creation_fingerprint, creator_id, updater_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$10)`,
      [
        mechId,
        input.workspaceId,
        definition.name,
        definition.model,
        definition.instructions,
        definition.dailyCapMicros,
        definition.status,
        input.requestId,
        fingerprint,
        input.principalId,
      ],
    );
    await saveRevision(transaction, mechId);

    return await getMech(transaction, { workspaceId: input.workspaceId, mechId });
  });
}

async function listMechs(context: StoreContext, input: MechPageInput): Promise<Page<Mech>> {
  if (input.after !== null) {
    const cursor = await context.client.query('SELECT id FROM mechane.mechs WHERE workspace_id = $1 AND id = $2', [
      input.workspaceId,
      input.after,
    ]);

    if (cursor.rowCount === 0) {
      throw new RequestInvalid({ reason: 'The mech page cursor is not in this workspace' });
    }
  }

  const result = await context.client.query<StoredMech>(
    `SELECT id, workspace_id AS "workspaceId", name, model, instructions,
  daily_cap_micros AS "dailyCapMicros", status, revision, creator_id AS "creatorId",
  updater_id AS "updaterId", created_at AS "createdAt", updated_at AS "updatedAt",
  forked_from AS "forkedFrom", creation_fingerprint AS "creationFingerprint" FROM mechane.mechs
     WHERE workspace_id = $1 AND ($2::uuid IS NULL OR (created_at,id) >
       (SELECT created_at,id FROM mechane.mechs WHERE workspace_id = $1 AND id = $2))
     ORDER BY created_at,id LIMIT $3`,
    [input.workspaceId, input.after, input.maxRows + 1],
  );

  return pageFromRows({ rows: result.rows, maxRows: input.maxRows });
}

async function updateMech(context: StoreContext, input: UpdateMechInput): Promise<Mech> {
  return await context.atomic(async (transaction) => {
    await lockMember(transaction, input.workspaceId, input.principalId);

    const locked = await transaction.client.query<StoredMech>(
      `SELECT id, workspace_id AS "workspaceId", name, model, instructions,
  daily_cap_micros AS "dailyCapMicros", status, revision, creator_id AS "creatorId",
  updater_id AS "updaterId", created_at AS "createdAt", updated_at AS "updatedAt",
  forked_from AS "forkedFrom", creation_fingerprint AS "creationFingerprint" FROM mechane.mechs WHERE workspace_id = $1 AND id = $2 FOR UPDATE`,
      [input.workspaceId, input.mechId],
    );

    const previous = locked.rows[0];

    if (previous === undefined) {
      throw new MechNotFound({ mechId: input.mechId });
    }

    if (previous.revision !== input.expectedRevision) {
      throw new MechRevisionConflict({
        mechId: Schema.decodeUnknownSync(MechId)(input.mechId),
        expectedRevision: input.expectedRevision,
        currentRevision: previous.revision,
      });
    }

    const definition = { ...previous, ...input.changes };

    await transaction.client.query(
      `UPDATE mechane.mechs SET name=$3,model=$4,instructions=$5,daily_cap_micros=$6,status=$7,
        revision=revision+1,updater_id=$8,updated_at=now() WHERE workspace_id=$1 AND id=$2`,
      [
        input.workspaceId,
        input.mechId,
        definition.name,
        definition.model,
        definition.instructions,
        definition.dailyCapMicros,
        definition.status,
        input.principalId,
      ],
    );
    await saveRevision(transaction, input.mechId);

    return await getMech(transaction, input);
  });
}

async function listMechRevisions(context: StoreContext, input: MechRevisionsInput): Promise<Page<MechRevision>> {
  await getMech(context, input);

  const result = await context.client.query<MechRevision>(
    `SELECT mech_id AS "mechId", revision, name, model, instructions, daily_cap_micros AS "dailyCapMicros",
      status, updater_id AS "updaterId", updated_at AS "updatedAt"
     FROM mechane.mech_revisions WHERE mech_id=$1 AND revision>$2 ORDER BY revision LIMIT $3`,
    [input.mechId, input.after, input.maxRows + 1],
  );

  return pageFromRows({ rows: result.rows, maxRows: input.maxRows });
}

async function getMechRevision(context: StoreContext, input: MechRevisionInput): Promise<MechRevision | null> {
  const result = await context.client.query<MechRevision>(
    `SELECT revisions.mech_id AS "mechId",revisions.revision,revisions.name,revisions.model,revisions.instructions,
      revisions.daily_cap_micros AS "dailyCapMicros",revisions.status,revisions.updater_id AS "updaterId",revisions.updated_at AS "updatedAt"
     FROM mechane.mech_revisions revisions JOIN mechane.mechs mechs ON mechs.id=revisions.mech_id
     WHERE mechs.workspace_id=$1 AND mechs.id=$2 AND revisions.revision=$3`,
    [input.workspaceId, input.mechId, input.revision],
  );

  return result.rows[0] ?? null;
}

async function getActiveRevision(context: StoreContext, input: MechScope): Promise<number | null> {
  const result = await context.client.query<{ readonly definition_revision: number }>(
    `SELECT definition_revision FROM mechane.runs
     WHERE workspace_id=$1 AND mech_id=$2 AND status IN ('running','waiting') ORDER BY created_at,id LIMIT 1`,
    [input.workspaceId, input.mechId],
  );

  return result.rows[0]?.definition_revision ?? null;
}

async function cloneMech(context: StoreContext, input: CloneMechInput): Promise<Mech> {
  const source = await getMech(context, input);

  const fingerprint = creationFingerprint({
    kind: 'clone',
    sourceId: input.mechId,
    name: input.name,
    principalId: input.principalId,
  });

  const creation = copiedMechInput(input, source);

  return await createMech(context, creation, fingerprint);
}

type ForkRun = {
  readonly id: string;
  readonly inputId: string;
  readonly sessionId: string;
  readonly notificationIds: ReadonlyArray<string>;
};

type ForkSession = {
  readonly id: string;
  readonly channelKey: string;
  readonly title: string;
  readonly source: string;
  readonly updatedAt: string;
  readonly createdAt: string;
};

type ForkEvent = {
  readonly runId: string | null;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

async function forkMech(context: StoreContext, input: CloneMechInput): Promise<Mech> {
  return await context.atomic(async (transaction) => {
    await transaction.client.query('SELECT id FROM mechane.workspaces WHERE id=$1 FOR UPDATE', [input.workspaceId]);
    await lockMember(transaction, input.workspaceId, input.principalId);

    const fingerprint = creationFingerprint({
      kind: 'fork',
      sourceId: input.mechId,
      name: input.name,
      principalId: input.principalId,
    });

    const existing = await findCreatedMech(transaction, {
      workspaceId: input.workspaceId,
      requestId: input.requestId,
      fingerprint,
    });

    if (existing !== undefined) {
      return existing;
    }

    await transaction.client.query('SELECT id FROM mechane.mechs WHERE workspace_id=$1 AND id=$2 FOR UPDATE', [
      input.workspaceId,
      input.mechId,
    ]);

    const source = await getMech(transaction, input);

    const pending = await transaction.client.query(
      `SELECT id FROM mechane.runs WHERE mech_id=$1 AND status IN ('queued','running','waiting')
       UNION ALL SELECT mech_id FROM mechane.mech_mailboxes WHERE mech_id=$1 AND is_wake_pending LIMIT 1`,
      [input.mechId],
    );

    if (pending.rowCount !== 0) {
      throw new MechBusy({ mechId: input.mechId });
    }

    const creation = copiedMechInput(input, source);
    const fork = await createMech(transaction, creation, fingerprint);

    const point = await transaction.client.query<{ readonly sequence: number }>(
      'SELECT coalesce(max(sequence),0) AS sequence FROM mechane.activity WHERE mech_id=$1',
      [input.mechId],
    );

    const sequence = point.rows[0]?.sequence ?? 0;
    const forkedFrom = { mechId: input.mechId, sequence };

    await transaction.client.query('DELETE FROM mechane.mech_revisions WHERE mech_id=$1', [fork.id]);
    await transaction.client.query(
      `INSERT INTO mechane.mech_revisions(mech_id,revision,name,model,instructions,daily_cap_micros,status,updater_id,updated_at)
       SELECT $1,revision,name,model,instructions,daily_cap_micros,status,updater_id,updated_at FROM mechane.mech_revisions WHERE mech_id=$2`,
      [fork.id, input.mechId],
    );
    await transaction.client.query('UPDATE mechane.mechs SET forked_from=$2,revision=$3 WHERE id=$1', [
      fork.id,
      forkedFrom,
      source.revision + 1,
    ]);
    await saveRevision(transaction, fork.id);

    const notificationReferences = await forkNotifications({
      context: transaction,
      workspaceId: input.workspaceId,
      sourceMechId: input.mechId,
      targetMechId: fork.id,
    });

    const notificationMap = JSON.stringify(Record.fromEntries(notificationReferences.ids));

    const sessions = await transaction.client.query<ForkSession>(
      'SELECT id,channel_key AS "channelKey",title,source,updated_at AS "updatedAt",created_at AS "createdAt" FROM mechane.sessions WHERE mech_id=$1',
      [input.mechId],
    );

    const sessionIds = new Map<string, string>();
    const runIds = new Map<string, string>();
    const inputIds = new Map<string, string>();

    for (const session of sessions.rows) {
      const sessionId = randomUUID();

      sessionIds.set(session.id, sessionId);
      await transaction.client.query(
        'INSERT INTO mechane.sessions(id,workspace_id,mech_id,channel_key,title,source,updated_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          sessionId,
          input.workspaceId,
          fork.id,
          session.channelKey,
          session.title,
          session.source,
          session.updatedAt,
          session.createdAt,
        ],
      );
    }

    const runs = await transaction.client.query<ForkRun>(
      `SELECT id,input_id AS "inputId",session_id AS "sessionId",notification_ids AS "notificationIds"
       FROM mechane.runs WHERE mech_id=$1 ORDER BY created_at,id`,
      [input.mechId],
    );

    for (const run of runs.rows) {
      const runId = randomUUID();
      const inputId = randomUUID();
      const sessionId = sessionIds.get(run.sessionId);

      if (sessionId === undefined) {
        throw new Error('The fork source run has no session.');
      }

      runIds.set(run.id, runId);
      inputIds.set(run.inputId, inputId);
      await transaction.client.query(
        `INSERT INTO mechane.inputs(id,workspace_id,mech_id,session_id,idempotency_key,input_text,input_message,attachments,origin,created_at)
         SELECT $1,$2,$3,$4,'fork:' || id,input_text,input_message,attachments,
           CASE WHEN origin->>'kind'='notification' AND origin->>'notificationId' IS NOT NULL
             THEN jsonb_set(origin,'{notificationId}',$6::jsonb->(origin->>'notificationId')) ELSE origin END,
           created_at FROM mechane.inputs WHERE id=$5`,
        [inputId, input.workspaceId, fork.id, sessionId, run.inputId, notificationMap],
      );

      const notificationIds = run.notificationIds.map((id) => mappedForkId({ id, ids: notificationReferences.ids }));

      await transaction.client.query(
        `INSERT INTO mechane.runs(id,workspace_id,mech_id,session_id,input_id,definition_revision,status,reply,error,failure_reason,cancel_requested_at,created_at,started_at,ended_at,notification_ids)
         SELECT $1,$2,$3,$4,$5,definition_revision,status,reply,error,failure_reason,cancel_requested_at,created_at,started_at,ended_at,$7 FROM mechane.runs WHERE id=$6`,
        [runId, input.workspaceId, fork.id, sessionId, inputId, run.id, notificationIds],
      );
      await transaction.client.query(
        `INSERT INTO mechane.messages(id,session_id,run_id,position,model_message,ui_message,created_at)
         SELECT gen_random_uuid(),$1,$2::uuid,position,model_message,
           CASE WHEN ui_message IS NULL THEN NULL ELSE jsonb_set(ui_message,'{metadata}',coalesce(ui_message->'metadata','{}') || jsonb_build_object('runId',($2::uuid)::text)) END,
           created_at FROM mechane.messages WHERE run_id=$3`,
        [sessionId, runId, run.id],
      );
    }

    const messageIds = await forkNotificationState({
      context: transaction,
      workspaceId: input.workspaceId,
      sourceMechId: input.mechId,
      targetMechId: fork.id,
      notifications: notificationReferences,
      sessionIds,
      runIds,
    });

    const events = await transaction.client.query<ForkEvent>(
      'SELECT run_id AS "runId",type,data AS payload,created_at AS "createdAt" FROM mechane.activity WHERE mech_id=$1 ORDER BY sequence',
      [input.mechId],
    );

    for (const event of events.rows) {
      const payload = forkNotificationPayload({
        type: event.type,
        payload: event.payload,
        notifications: notificationReferences,
        messageIds,
      });

      if (typeof payload['turnId'] === 'string') {
        payload['turnId'] = runIds.get(payload['turnId']) ?? payload['turnId'];
      }

      if (typeof payload['inboxItemId'] === 'string') {
        payload['inboxItemId'] = inputIds.get(payload['inboxItemId']) ?? payload['inboxItemId'];
      }

      if (Array.isArray(payload['inboxItemIds'])) {
        payload['inboxItemIds'] = payload['inboxItemIds'].map((id: unknown) => {
          if (typeof id === 'string') {
            return inputIds.get(id) ?? id;
          }

          return id;
        });
      }

      await transaction.client.query(
        'INSERT INTO mechane.activity(id,workspace_id,mech_id,run_id,type,data,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          randomUUID(),
          input.workspaceId,
          fork.id,
          forkEventRunId(event.runId, runIds),
          event.type,
          payload,
          event.createdAt,
        ],
      );
    }

    await transaction.client.query(
      `INSERT INTO mechane.memories(workspace_id,mech_id,path,text,digest,version,run_id,updated_at)
       SELECT $1,$2,path,text,digest,version,($4::jsonb->>run_id::text)::uuid,updated_at FROM mechane.memories WHERE mech_id=$3 AND deleted_at IS NULL`,
      [input.workspaceId, fork.id, input.mechId, JSON.stringify(Record.fromEntries(runIds))],
    );
    await transaction.client.query(
      `INSERT INTO mechane.work_items(id,workspace_id,mech_id,title,state,note,created_at,updated_at)
       SELECT gen_random_uuid(),$1,$2,title,state,note,created_at,updated_at FROM mechane.work_items WHERE mech_id=$3`,
      [input.workspaceId, fork.id, input.mechId],
    );
    await transaction.client.query(
      `INSERT INTO mechane.activity(id,workspace_id,mech_id,type,data) VALUES($1,$2,$3,'mech.forked',$4)`,
      [randomUUID(), input.workspaceId, fork.id, { forkedFrom }],
    );

    return await getMech(transaction, { workspaceId: input.workspaceId, mechId: fork.id });
  });
}

export function createMechStore(context: StoreContext) {
  return {
    getMech: (input: MechScope) => getMech(context, input),
    listMechs: (input: MechPageInput) => listMechs(context, input),
    createMech: (input: CreateMechInput) => createMech(context, input),
    updateMech: (input: UpdateMechInput) => updateMech(context, input),
    listMechRevisions: (input: MechRevisionsInput) => listMechRevisions(context, input),
    getMechRevision: (input: MechRevisionInput) => getMechRevision(context, input),
    getActiveRevision: (input: MechScope) => getActiveRevision(context, input),
    cloneMech: (input: CloneMechInput) => cloneMech(context, input),
    forkMech: (input: CloneMechInput) => forkMech(context, input),
  };
}

function forkEventRunId(runId: string | null, runIds: ReadonlyMap<string, string>): string | null | undefined {
  if (runId === null) {
    return null;
  }

  return runIds.get(runId);
}

type CreationLookup = { readonly workspaceId: string; readonly requestId: string; readonly fingerprint: string };

async function findCreatedMech(context: StoreContext, input: CreationLookup): Promise<Mech | undefined> {
  const previous = await context.client.query<StoredMech>(
    `SELECT id, workspace_id AS "workspaceId", name, model, instructions,
  daily_cap_micros AS "dailyCapMicros", status, revision, creator_id AS "creatorId",
  updater_id AS "updaterId", created_at AS "createdAt", updated_at AS "updatedAt",
  forked_from AS "forkedFrom", creation_fingerprint AS "creationFingerprint" FROM mechane.mechs WHERE workspace_id=$1 AND creation_request_id=$2`,
    [input.workspaceId, input.requestId],
  );

  const existing = previous.rows[0];

  if (existing !== undefined && existing.creationFingerprint !== input.fingerprint) {
    throw new MechCreationConflict({ requestId: Schema.decodeUnknownSync(CreationRequestRecordId)(input.requestId) });
  }

  return existing;
}

function copiedMechInput(input: CloneMechInput, source: Mech): CreateMechInput {
  return {
    workspaceId: input.workspaceId,
    principalId: input.principalId,
    requestId: input.requestId,
    definition: {
      name: input.name,
      model: source.model,
      instructions: source.instructions,
      dailyCapMicros: source.dailyCapMicros,
      status: 'paused',
    },
  };
}

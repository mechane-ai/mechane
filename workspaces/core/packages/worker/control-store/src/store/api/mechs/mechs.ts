import { MechCreationConflict, MechNotFound, MechRevisionConflict, RequestInvalid } from '@mechane/protocol';
import { CreationRequestRecordId, MechId } from '@mechane/records';
import { Schema } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import type { Mech, MechDefinition, MechRevision } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { queueControlChanges } from '../../control-changes.ts';
import { lockMember } from '../../member-admission.ts';
import { lockWorkspace } from '../../scope-locks.ts';
import { pageFromRows } from '../page.ts';
import type { Page } from '../page.ts';

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

export type ForkMechDefinitionInput = CloneMechInput & {
  readonly expectedRevision: number;
  readonly sourceSequence: number;
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

function creationFingerprint(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function createMech(context: StoreContext, input: CreateMechInput, requestFingerprint?: string): Promise<Mech> {
  return await context.atomic(async (transaction) => {
    await lockWorkspace({ client: transaction.client, workspaceId: input.workspaceId });
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
    await queueControlChanges({ context: transaction, workspaceId: input.workspaceId, mechId });

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
    await lockWorkspace({ client: transaction.client, workspaceId: input.workspaceId });
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
    await queueControlChanges({ context: transaction, workspaceId: input.workspaceId, mechId: input.mechId });

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

async function forkMechDefinition(context: StoreContext, input: ForkMechDefinitionInput): Promise<Mech> {
  if (!Number.isSafeInteger(input.sourceSequence) || input.sourceSequence < 0) {
    throw new RequestInvalid({ reason: 'fork source sequence must be a nonnegative safe integer' });
  }

  return await context.atomic(async (transaction) => {
    await lockWorkspace({ client: transaction.client, workspaceId: input.workspaceId });
    await lockMember(transaction, input.workspaceId, input.principalId);

    const fingerprint = creationFingerprint({
      kind: 'actor-fork',
      sourceId: input.mechId,
      name: input.name,
      principalId: input.principalId,
      expectedRevision: input.expectedRevision,
      sourceSequence: input.sourceSequence,
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

    if (source.revision !== input.expectedRevision) {
      throw new MechRevisionConflict({
        mechId: Schema.decodeUnknownSync(MechId)(input.mechId),
        expectedRevision: input.expectedRevision,
        currentRevision: source.revision,
      });
    }

    const creation = copiedMechInput(input, source);
    const created = await createMech(transaction, creation, fingerprint);

    await transaction.client.query('UPDATE mechane.mechs SET forked_from=$2 WHERE id=$1', [
      created.id,
      { mechId: input.mechId, sequence: input.sourceSequence },
    ]);

    return await getMech(transaction, { workspaceId: input.workspaceId, mechId: created.id });
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
    cloneMech: (input: CloneMechInput) => cloneMech(context, input),
    forkMechDefinition: (input: ForkMechDefinitionInput) => forkMechDefinition(context, input),
  };
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

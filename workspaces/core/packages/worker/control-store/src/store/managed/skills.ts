import { HttpStatusCode } from '@mechane/records';
import type { Buffer } from 'node:buffer';
import type { StoreContext } from '../context.ts';
import { managedDocument, managedId, ManagedStoreError, pageSize } from './managed-record.ts';
import { prepareSkillBundle } from './skill-bundle.ts';
import type { SkillFile } from './skill-bundle.ts';
import type { ManagedScope } from './types.ts';

type Skill = {
  readonly type: 'skill';
  readonly id: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly display_name: string;
  readonly latest_version_id: string;
  readonly source: { readonly type: 'custom' };
};

type Version = {
  readonly type: 'skill_version';
  readonly id: string;
  readonly skill_id: string;
  readonly name: string;
  readonly description: string;
  readonly created_at: string;
};

type SkillTarget = { readonly scope: ManagedScope; readonly skillId: string };
type VersionTarget = SkillTarget & { readonly version: string };
type SkillUpload = { readonly files: ReadonlyArray<SkillFile> };
type ListQuery = { readonly page?: string; readonly maxRows?: number };
type SkillList = ListQuery & { readonly scope: ManagedScope; readonly source?: string };
type SkillsPage<Entry> = { readonly data: ReadonlyArray<Entry>; readonly next_page: string | null };
type SkillReference = { readonly type: 'custom'; readonly skill_id: string; readonly version: string };

const VISIBLE_SKILL = 's.workspace_id=$1 AND (s.creator_id=$2 OR $3) AND s.deleted_at IS NULL';

const SKILL_COLUMNS =
  "s.id,s.display_name,s.created_at,s.updated_at,s.latest_version_id,'skill' AS type,jsonb_build_object('type','custom') AS source";

const VERSION_COLUMNS = "v.id,v.skill_id,v.description,v.created_at,s.name,'skill_version' AS type";
const PAGE_MAX_ROWS = 1000;
const DISPLAY_NAME_MAX_CHARS = 255;

function scopeValues(scope: ManagedScope): readonly [string, string, boolean] {
  return [scope.workspaceId, scope.principalId, scope.isAdmin];
}

function first<Entry>(rows: ReadonlyArray<Entry>): Entry {
  const entry = rows[0];

  if (entry === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Skill or skill version not found');
  }

  return entry;
}

function pageOf<Entry extends { readonly id: string }>(rows: ReadonlyArray<Entry>, maxRows: number): SkillsPage<Entry> {
  const entries = rows.slice(0, maxRows);

  if (rows.length > maxRows) {
    const last = first(entries.slice(-1));

    return { data: entries, next_page: last.id };
  }

  return { data: entries, next_page: null };
}

async function get(context: StoreContext, { scope, skillId }: SkillTarget): Promise<Skill> {
  const result = await context.client.query<Skill>(
    `SELECT ${SKILL_COLUMNS} FROM mechane.managed_skills s WHERE ${VISIBLE_SKILL} AND s.id=$4`,
    [...scopeValues(scope), skillId],
  );

  return first(result.rows);
}

async function lockSkill(context: StoreContext, { scope, skillId }: SkillTarget): Promise<void> {
  const result = await context.client.query(
    `SELECT s.id FROM mechane.managed_skills s WHERE s.workspace_id=$1 AND (s.creator_id=$2 OR $3)
     AND s.deleted_at IS NULL AND s.id=$4 FOR UPDATE`,
    [...scopeValues(scope), skillId],
  );

  first(result.rows);
}

async function versionFor(context: StoreContext, { scope, skillId, version }: VersionTarget): Promise<Version> {
  const result = await context.client.query<Version>(
    `SELECT ${VERSION_COLUMNS} FROM mechane.managed_skills s JOIN mechane.managed_skill_versions v ON v.skill_id=s.id
     WHERE ${VISIBLE_SKILL} AND s.id=$4 AND v.deleted_at IS NULL
       AND v.id=CASE WHEN $5='latest' THEN s.latest_version_id ELSE $5 END FOR SHARE OF s,v`,
    [...scopeValues(scope), skillId, version],
  );

  return first(result.rows);
}

type SkillVersionUpload = {
  readonly skillId: string;
  readonly versionId: string;
  readonly bundle: ReturnType<typeof prepareSkillBundle>;
};

async function insertVersion(context: StoreContext, { skillId, versionId, bundle }: SkillVersionUpload): Promise<void> {
  await context.client.query(
    `INSERT INTO mechane.managed_skill_versions(id,skill_id,ordinal,description,archive)
       SELECT $1,$2,coalesce(max(ordinal),0)+1,$3,$4 FROM mechane.managed_skill_versions WHERE skill_id=$2`,
    [versionId, skillId, bundle.description, bundle.archive],
  );
}

type ResolveSkills = {
  readonly context: StoreContext;
  readonly scope: ManagedScope;
  readonly skills?: unknown;
  readonly shouldPinLatest?: boolean;
};

export async function resolveAgentSkills({
  context,
  scope,
  skills = [],
  shouldPinLatest = false,
}: ResolveSkills): Promise<ReadonlyArray<SkillReference>> {
  if (!Array.isArray(skills)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Agent skills must be an array');
  }

  const references = skills.map((value: unknown): SkillReference => {
    const skill = managedDocument(value, 'skill');

    if (skill['type'] !== 'custom' || typeof skill['skill_id'] !== 'string') {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Self-hosted agents require uploaded custom skills');
    }

    const version: unknown = skill['version'] ?? 'latest';

    if (typeof version !== 'string') {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Skill version must be an ID or latest');
    }

    return { type: 'custom', skill_id: skill['skill_id'], version };
  });

  if (references.length === 0) {
    return [];
  }

  const ids = references.map((reference) => reference.skill_id);
  const versions = references.map((reference) => reference.version);

  const { rows } = await context.client.query<SkillReference>(
    `SELECT 'custom' AS type, s.id AS skill_id, CASE WHEN $6 THEN v.id ELSE ref.version END AS version
       FROM unnest($4::text[],$5::text[]) WITH ORDINALITY AS ref(skill_id,version,position)
       JOIN mechane.managed_skills s ON s.id=ref.skill_id
       JOIN mechane.managed_skill_versions v ON v.skill_id=s.id
         AND v.id=CASE WHEN ref.version='latest' THEN s.latest_version_id ELSE ref.version END
      WHERE ${VISIBLE_SKILL} AND v.deleted_at IS NULL ORDER BY ref.position FOR SHARE OF s,v`,
    [...scopeValues(scope), ids, versions, shouldPinLatest],
  );

  if (rows.length !== references.length) {
    throw new ManagedStoreError(
      HttpStatusCode.BadRequest,
      'Agent configuration references an unavailable skill version',
    );
  }

  return rows;
}

export function createManagedSkillStore(context: StoreContext) {
  return {
    create: async ({
      scope,
      displayName,
      files,
    }: { readonly scope: ManagedScope; readonly displayName?: string } & SkillUpload): Promise<Skill> => {
      const bundle = prepareSkillBundle(files);
      const display = displayName ?? bundle.name;

      if (display.trim().length === 0 || display.length > DISPLAY_NAME_MAX_CHARS || /[\r\n]/u.test(display)) {
        throw new ManagedStoreError(
          HttpStatusCode.BadRequest,
          'Skill display name must be a single line of 1 to 255 characters',
        );
      }

      const skillId = managedId('skill');
      const versionId = managedId('skver');

      return await context.atomic(async (transaction) => {
        await transaction.client.query(
          `INSERT INTO mechane.managed_skills(id,workspace_id,creator_id,name,display_name,latest_version_id)
             VALUES ($1,$2,$3,$4,$5,$6)`,
          [skillId, scope.workspaceId, scope.principalId, bundle.name, display, versionId],
        );
        await insertVersion(transaction, { skillId, versionId, bundle });

        return await get(transaction, { scope, skillId });
      });
    },
    get: async (target: SkillTarget) => await get(context, target),
    list: async (query: SkillList): Promise<SkillsPage<Skill>> => {
      const maxRows = pageSize(query, PAGE_MAX_ROWS);

      if (query.source !== undefined && query.source !== 'custom') {
        if (query.source === 'anthropic') {
          return { data: [], next_page: null };
        }

        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unsupported skill source');
      }

      if (query.page !== undefined) {
        await get(context, { scope: query.scope, skillId: query.page });
      }

      const result = await context.client.query<Skill>(
        `SELECT ${SKILL_COLUMNS} FROM mechane.managed_skills s WHERE ${VISIBLE_SKILL}
           AND ($4::text IS NULL OR (s.created_at,s.id)<(SELECT created_at,id FROM mechane.managed_skills WHERE id=$4))
         ORDER BY s.created_at DESC,s.id DESC LIMIT $5`,
        [...scopeValues(query.scope), query.page ?? null, maxRows + 1],
      );

      return pageOf(result.rows, maxRows);
    },
    delete: async ({ scope, skillId }: SkillTarget) => {
      const result = await context.client.query(
        `UPDATE mechane.managed_skills s SET deleted_at=now() WHERE s.workspace_id=$1 AND (s.creator_id=$2 OR $3)
           AND s.deleted_at IS NULL AND s.id=$4 RETURNING id`,
        [...scopeValues(scope), skillId],
      );

      first(result.rows);

      return { type: 'skill_deleted', id: skillId };
    },
    createVersion: async ({ scope, skillId, files }: SkillTarget & SkillUpload): Promise<Version> => {
      const bundle = prepareSkillBundle(files);
      const versionId = managedId('skver');

      return await context.atomic(async (transaction) => {
        await lockSkill(transaction, { scope, skillId });

        const result = await transaction.client.query(
          `UPDATE mechane.managed_skills SET latest_version_id=$2,updated_at=now() WHERE id=$1 AND name=$3 RETURNING id`,
          [skillId, versionId, bundle.name],
        );

        if (result.rows.length === 0) {
          throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Skill version name differs from the first upload');
        }

        await insertVersion(transaction, { skillId, versionId, bundle });

        return await versionFor(transaction, { scope, skillId, version: versionId });
      });
    },
    getVersion: async (target: VersionTarget) => await versionFor(context, target),
    listVersions: async (query: SkillTarget & ListQuery): Promise<SkillsPage<Version>> => {
      const maxRows = pageSize(query, PAGE_MAX_ROWS);

      await get(context, query);

      if (query.page !== undefined) {
        await versionFor(context, { ...query, version: query.page });
      }

      const result = await context.client.query<Version>(
        `SELECT ${VERSION_COLUMNS} FROM mechane.managed_skills s JOIN mechane.managed_skill_versions v ON v.skill_id=s.id
           WHERE ${VISIBLE_SKILL} AND s.id=$4 AND v.deleted_at IS NULL
             AND ($5::text IS NULL OR v.ordinal<(SELECT ordinal FROM mechane.managed_skill_versions WHERE skill_id=$4 AND id=$5))
           ORDER BY v.ordinal DESC LIMIT $6`,
        [...scopeValues(query.scope), query.skillId, query.page ?? null, maxRows + 1],
      );

      return pageOf(result.rows, maxRows);
    },
    deleteVersion: async (target: VersionTarget) =>
      await context.atomic(async (transaction) => {
        const { skillId } = target;

        await lockSkill(transaction, target);

        const version = await versionFor(transaction, target);

        const substitute = await transaction.client.query<{ readonly id: string }>(
          'SELECT id FROM mechane.managed_skill_versions WHERE skill_id=$1 AND deleted_at IS NULL AND id<>$2 ORDER BY ordinal DESC LIMIT 1',
          [skillId, version.id],
        );

        const latest = substitute.rows[0];

        if (latest === undefined) {
          throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Delete the skill to remove its final version');
        }

        await transaction.client.query('UPDATE mechane.managed_skill_versions SET deleted_at=now() WHERE id=$1', [
          version.id,
        ]);
        await transaction.client.query(
          'UPDATE mechane.managed_skills SET updated_at=now(),latest_version_id=$2 WHERE id=$1',
          [skillId, latest.id],
        );

        return { type: 'skill_version_deleted', id: version.id };
      }),
    sessionVersion: async ({
      workspaceId,
      sessionId,
      leaseId,
      skillId,
      version,
      includeArchive,
    }: {
      readonly workspaceId: string;
      readonly sessionId: string;
      readonly leaseId: string;
      readonly skillId: string;
      readonly version: string;
      readonly includeArchive: boolean;
    }) => {
      const result = await context.client.query<Version & { readonly archive: Buffer | null }>(
        `SELECT ${VERSION_COLUMNS}, CASE WHEN $5 THEN v.archive ELSE NULL END AS archive
           FROM mechane.managed_sessions sess
           JOIN mechane.managed_skills s ON s.workspace_id=sess.workspace_id AND s.id=$3
           JOIN mechane.managed_skill_versions v ON v.skill_id=s.id AND v.id=$4
           JOIN mechane.managed_work w ON w.workspace_id=sess.workspace_id AND w.session_id=sess.id
          WHERE sess.id=$2 AND sess.workspace_id=$1 AND sess.archived_at IS NULL AND sess.status<>'terminated'
            AND w.lease_id=$6 AND w.state IN ('starting','active','stopping') AND w.lease_until>clock_timestamp()
            AND EXISTS (
              SELECT 1 FROM (
                SELECT sess.configuration->'agent' AS agent
                UNION ALL
                SELECT member FROM jsonb_array_elements(sess.configuration #> '{agent,multiagent,agents}') member
                 WHERE sess.configuration #>> '{agent,multiagent,type}' = 'coordinator'
              ) AS roster
              WHERE roster.agent->'skills' @> jsonb_build_array(jsonb_build_object('type','custom','skill_id',s.id,'version',v.id))
            )`,
        [workspaceId, sessionId, skillId, version, includeArchive, leaseId],
      );

      const { archive, ...record } = first(result.rows);

      return { record, archive };
    },
    content: async ({ scope, skillId, version }: VersionTarget) => {
      const result = await context.client.query<{ readonly name: string; readonly archive: Buffer }>(
        `SELECT s.name,v.archive FROM mechane.managed_skills s JOIN mechane.managed_skill_versions v ON v.skill_id=s.id
           WHERE ${VISIBLE_SKILL} AND s.id=$4 AND v.deleted_at IS NULL
             AND v.id=CASE WHEN $5='latest' THEN s.latest_version_id ELSE $5 END`,
        [...scopeValues(scope), skillId, version],
      );

      return first(result.rows);
    },
  };
}

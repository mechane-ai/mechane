import { HttpStatusCode, isWellFormedText } from '@mechane/records';
import { Record, Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { StoredTimestamp } from '../row-values.ts';
import { createEnvironmentKeyStore, requireEnvironmentAdmin } from './environment-keys.ts';
import { decodePage, encodePage, managedId, ManagedStoreError, pageSize } from './managed-record.ts';
import type { ManagedPageQuery, ManagedScope } from './types.ts';

const NAME_MAX_CHARS = 256;
const DESCRIPTION_MAX_CHARS = 1024;

const EnvironmentText = Schema.String.check(
  isWellFormedText,
  Schema.makeFilter((text: string) => !text.includes('\u0000')),
);

const Name = EnvironmentText.check(Schema.isMinLength(1), Schema.isMaxLength(NAME_MAX_CHARS));
const Description = Schema.NullOr(EnvironmentText.check(Schema.isMaxLength(DESCRIPTION_MAX_CHARS)));
const CONFIGURATION_FIELD = 'config';
const SelfHostedConfiguration = Schema.Struct({ type: Schema.Literal('self_hosted') });
const Organization = Schema.Literal('organization');
const Metadata = Schema.Record(EnvironmentText, EnvironmentText);

const EnvironmentFields = Schema.Struct({
  [CONFIGURATION_FIELD]: Schema.optionalKey(Schema.NullOr(SelfHostedConfiguration)),
  description: Schema.optionalKey(Description),
  scope: Schema.optionalKey(Schema.NullOr(Organization)),
});

const CreateEnvironment = Schema.Struct({
  ...EnvironmentFields.fields,
  name: Name,
  metadata: Schema.optionalKey(Metadata),
});

const UpdateEnvironment = Schema.Struct({
  ...EnvironmentFields.fields,
  name: Schema.optionalKey(Schema.NullOr(Name)),
  metadata: Schema.optionalKey(Schema.Record(EnvironmentText, Schema.NullOr(EnvironmentText))),
});

const EnvironmentRow = Schema.Struct({
  id: Schema.String,
  name: Name,
  description: Description,
  metadata: Metadata,
  created_at: StoredTimestamp,
  updated_at: StoredTimestamp,
  archived_at: Schema.NullOr(StoredTimestamp),
});

const MAXIMUM_PAGE_ROWS = 1000;
type ScopedEnvironment = { readonly scope: ManagedScope; readonly id: string };
type EnvironmentInput = ScopedEnvironment & { readonly body: unknown };
type EnvironmentCreation = { readonly scope: ManagedScope; readonly body: unknown };
type EnvironmentPage = { readonly scope: ManagedScope; readonly query: ManagedPageQuery };

function environment(row: unknown) {
  const record = Schema.decodeUnknownSync(EnvironmentRow, { onExcessProperty: 'error' })(row);

  return { ...record, type: 'environment', [CONFIGURATION_FIELD]: { type: 'self_hosted' }, scope: 'organization' };
}

function readInput<S extends Schema.Codec<unknown, unknown>>(schema: S, body: unknown): S['Type'] {
  const decoded = Schema.decodeUnknownResult(schema, { onExcessProperty: 'error' })(body);

  if (decoded._tag === 'Failure') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid self-hosted environment configuration.');
  }

  return decoded.success;
}

function missingEnvironment(): never {
  throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment not found.');
}

export function createManagedEnvironmentStore(context: StoreContext) {
  async function get({ scope, id }: ScopedEnvironment) {
    const result = await context.client.query(
      `SELECT id, name, description, metadata, created_at, updated_at, archived_at FROM mechane.managed_environments WHERE workspace_id=$1 AND id=$2`,
      [scope.workspaceId, id],
    );

    if (result.rows[0] === undefined) {
      return null;
    }

    return environment(result.rows[0]);
  }

  return {
    ...createEnvironmentKeyStore(context),

    async create({ scope, body }: EnvironmentCreation) {
      requireEnvironmentAdmin(scope);

      const fields = readInput(CreateEnvironment, body);
      const id = managedId('env');

      const result = await context.client.query(
        `INSERT INTO mechane.managed_environments (id,workspace_id,creator_id,name,description,metadata)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id, name, description, metadata, created_at, updated_at, archived_at`,
        [
          id,
          scope.workspaceId,
          scope.principalId,
          fields.name,
          fields.description ?? null,
          JSON.stringify(fields.metadata ?? {}),
        ],
      );

      return environment(result.rows[0]);
    },

    get,

    async list({ scope, query }: EnvironmentPage) {
      const cursor = decodePage(query.page);
      const limit = pageSize(query, MAXIMUM_PAGE_ROWS);

      const result = await context.client.query(
        `SELECT id, name, description, metadata, created_at, updated_at, archived_at FROM mechane.managed_environments
         WHERE workspace_id=$1 AND ($2::boolean OR archived_at IS NULL)
         AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::text))
         ORDER BY created_at DESC,id DESC LIMIT $5`,
        [scope.workspaceId, query.includeArchived ?? false, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
      );

      const records = result.rows.slice(0, limit).map(environment);
      const last = records.at(-1);

      if (result.rows.length > limit && last !== undefined) {
        return { data: records, next_page: encodePage({ createdAt: last.created_at, id: last.id }) };
      }

      return { data: records, next_page: null };
    },

    async update({ scope, id, body }: EnvironmentInput) {
      requireEnvironmentAdmin(scope);

      const fields = readInput(UpdateEnvironment, body);

      const patch = Record.map(fields.metadata ?? {}, (value) => {
        if (value === '') {
          return null;
        }

        return value;
      });

      const result = await context.client.query(
        `UPDATE mechane.managed_environments SET
           name=COALESCE($3,name),
           description=CASE WHEN $4::boolean THEN $5::text ELSE description END,
           metadata=jsonb_strip_nulls(metadata || $6::jsonb), updated_at=now()
         WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL RETURNING id, name, description, metadata, created_at, updated_at, archived_at`,
        [
          scope.workspaceId,
          id,
          fields.name ?? null,
          Object.hasOwn(fields, 'description'),
          fields.description ?? null,
          JSON.stringify(patch),
        ],
      );

      if (result.rows[0] === undefined) {
        const found = await get({ scope, id });

        if (found !== null) {
          throw new ManagedStoreError(HttpStatusCode.Conflict, 'Archived environments cannot be updated.');
        }

        return missingEnvironment();
      }

      return environment(result.rows[0]);
    },

    async archive({ scope, id }: ScopedEnvironment) {
      requireEnvironmentAdmin(scope);

      const result = await context.client.query(
        `UPDATE mechane.managed_environments SET archived_at=COALESCE(archived_at,now()), updated_at=COALESCE(archived_at,now())
         WHERE workspace_id=$1 AND id=$2 RETURNING id, name, description, metadata, created_at, updated_at, archived_at`,
        [scope.workspaceId, id],
      );

      if (result.rows[0] === undefined) {
        return missingEnvironment();
      }

      return environment(result.rows[0]);
    },

    async remove({ scope, id }: ScopedEnvironment) {
      requireEnvironmentAdmin(scope);

      try {
        const result = await context.client.query(
          'DELETE FROM mechane.managed_environments WHERE workspace_id=$1 AND id=$2',
          [scope.workspaceId, id],
        );

        if (result.rowCount !== 1) {
          return missingEnvironment();
        }

        return { id, type: 'environment_deleted' };
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === '23503') {
          throw new ManagedStoreError(HttpStatusCode.Conflict, 'Existing sessions still reference this environment.');
        }

        throw error;
      }
    },
  };
}

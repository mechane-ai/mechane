import { Record, Schema } from 'effect';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runCommand } from '../../process.ts';
import type { ConversationImport, ConversationImportScope, Environment } from '../../types.ts';

type SeedConversationImport = ConversationImportScope & {
  readonly container: string;
  readonly environment: Environment;
  readonly migrationUrl: string;
};

export type HistoricalConversationFixture = ConversationImport & {
  readonly sourceDatabaseUrl: string;
  readonly sourceDatabaseName: string;
  readonly retirementEvidence: Readonly<Record<string, unknown>>;
};

const FrozenSchema = Schema.Struct({
  version: Schema.Literal(1),
  source: Schema.Struct({
    revision: Schema.Literal('000b1f2fdbb98e512c2a026ca140db293d724676'),
    repositoryPath: Schema.Literal('workspaces/core/packages/node/runtime/src/store/schema.ts'),
  }),
  migrations: Schema.Array(Schema.Struct({ version: Schema.Number, checksum: Schema.String, sql: Schema.String })),
});

type FixtureSqlInput = SeedConversationImport & {
  readonly database: string;
  readonly sql: string;
  readonly variables?: Readonly<Record<string, string>>;
};

type SourceDatabaseAddress = { readonly database: string };

const INVALID_SOURCE_ID = '00000000-0000-4000-8000-000000000003';
const VALID_SOURCE_ID = '00000000-0000-4000-8000-000000000002';
const IMPORTED_AT = '2026-11-05T12:00:00.000Z';
const VALID_IMPORTED_AT = '2026-11-05T12:01:00.000Z';
const NATIVE_AT = '2026-11-05T12:02:00.000Z';

export async function seedConversationImport(input: SeedConversationImport): Promise<HistoricalConversationFixture> {
  const sourceDatabaseName = `conversation_import_${randomUUID().replaceAll('-', '_')}`;
  const sourceDatabaseUrl = new URL(input.migrationUrl);

  sourceDatabaseUrl.pathname = sourceDatabasePath({ database: sourceDatabaseName });

  await runFixtureSql({
    ...input,
    database: 'postgres',
    variables: { database: sourceDatabaseName },
    sql: 'CREATE DATABASE :"database";',
  });

  const frozen = Schema.decodeUnknownSync(Schema.fromJsonString(FrozenSchema))(
    await readFile(new URL('frozen-conversation-schema3.json', import.meta.url), 'utf8'),
  );

  for (const migration of frozen.migrations) {
    const checksum = createHash('sha256').update(migration.sql).digest('hex');

    if (checksum !== migration.checksum) {
      throw new Error('The frozen conversation schema checksum changed');
    }

    await runFixtureSql({
      ...input,
      database: sourceDatabaseName,
      variables: { version: String(migration.version), checksum },
      sql: `BEGIN;\n${migration.sql}\nINSERT INTO mechane.schema_migrations(version,checksum) VALUES (:'version'::integer,:'checksum');\nCOMMIT;`,
    });
  }

  const runId = randomUUID();
  const text = 'The retained Console response includes its original punctuation: **done**.';
  const cardText = 'The retained card still names Cloudflare.';
  const validText = 'This imported publication already has a valid UUID.';

  const presentation = {
    spec: {
      root: 'result',
      elements: {
        result: { type: 'Card', props: {}, children: ['answer'] },
        answer: { type: 'Text', props: { content: 'Cloudflare' }, children: [] },
      },
    },
    fallback: cardText,
  };

  const publications = [
    {
      id: '5d236eca-bc8c-a548-f9b1-c6069e940cf9',
      toolCallId: `imported-message:${INVALID_SOURCE_ID}:1`,
      text,
      presentation: null,
      createdAt: IMPORTED_AT,
      shouldRepairId: true,
    },
    {
      id: 'c0aef173-ff26-409b-d18e-0ef220900d01',
      toolCallId: `imported-message:${INVALID_SOURCE_ID}:2`,
      text: cardText,
      presentation,
      createdAt: IMPORTED_AT,
      shouldRepairId: true,
    },
    {
      id: '205c8026-37bb-16ee-bff4-0a4060a58b52',
      toolCallId: `imported-message:${VALID_SOURCE_ID}:1`,
      text: validText,
      presentation: null,
      createdAt: VALID_IMPORTED_AT,
      shouldRepairId: false,
    },
    {
      id: randomUUID(),
      toolCallId: randomUUID(),
      text: 'This publication was sent through the explicit Console tool.',
      presentation: null,
      createdAt: NATIVE_AT,
      shouldRepairId: false,
    },
  ];

  const fixture = {
    workspaceId: input.workspaceId,
    mechId: input.mechId,
    sessionId: randomUUID(),
    inputId: randomUUID(),
    runId,
    principalId: randomUUID(),
    creationRequestId: randomUUID(),
    createdAt: IMPORTED_AT,
    messages: [
      {
        id: INVALID_SOURCE_ID,
        position: 0,
        createdAt: IMPORTED_AT,
        ui: {
          id: INVALID_SOURCE_ID,
          role: 'assistant',
          parts: [
            { type: 'text', text },
            {
              type: 'tool-render_ui',
              toolCallId: randomUUID(),
              state: 'output-available',
              input: {},
              output: presentation,
            },
          ],
        },
      },
      {
        id: VALID_SOURCE_ID,
        position: 1,
        createdAt: VALID_IMPORTED_AT,
        ui: { id: VALID_SOURCE_ID, role: 'assistant', parts: [{ type: 'text', text: validText }] },
      },
    ],
    publications: publications.map((publication) => ({ ...publication, activityId: randomUUID() })),
  };

  await runFixtureSql({
    ...input,
    database: sourceDatabaseName,
    variables: { fixture: JSON.stringify(fixture) },
    sql: `
BEGIN;
DO $fixture_schema$
BEGIN
  IF (SELECT max(version) FROM mechane.schema_migrations) <> 3 THEN
    RAISE EXCEPTION 'The historical Console fixture requires its frozen schema 3 source';
  END IF;
END;
$fixture_schema$;
WITH fixture AS (SELECT :'fixture'::jsonb AS data),
principal AS (
  INSERT INTO mechane.principals(id,name)
  SELECT (data->>'principalId')::uuid,'Historical fixture principal' FROM fixture RETURNING id
),
workspace AS (
  INSERT INTO mechane.workspaces(id,name,creator_id,policy)
  SELECT (data->>'workspaceId')::uuid,'Historical fixture workspace',principal.id,'{"isSuspended":true}'::jsonb
  FROM fixture CROSS JOIN principal RETURNING id,creator_id
),
mech AS (
  INSERT INTO mechane.mechs(id,workspace_id,name,model,status,revision,creation_request_id,creation_fingerprint,creator_id,updater_id)
  SELECT (data->>'mechId')::uuid,workspace.id,'Historical Console fixture','openai/gpt-6.1-sol','paused',1,
    (data->>'creationRequestId')::uuid,'frozen-conversation-fixture',workspace.creator_id,workspace.creator_id
  FROM fixture CROSS JOIN workspace RETURNING id,name,model,creator_id
)
INSERT INTO mechane.mech_revisions(mech_id,revision,name,model,daily_cap_micros,status,updater_id)
SELECT id,1,name,model,50000000,'paused',creator_id FROM mech;
WITH fixture AS (SELECT :'fixture'::jsonb AS data),
session AS (
  INSERT INTO mechane.sessions(id,workspace_id,mech_id,channel_key,source,created_at,updated_at)
  SELECT (data->>'sessionId')::uuid,(data->>'workspaceId')::uuid,(data->>'mechId')::uuid,
    'console-import-fixture','console',(data->>'createdAt')::timestamptz,(data->>'createdAt')::timestamptz
  FROM fixture RETURNING id
),
input AS (
  INSERT INTO mechane.inputs(id,workspace_id,mech_id,session_id,idempotency_key,input_text,input_message,origin,created_at)
  SELECT (data->>'inputId')::uuid,(data->>'workspaceId')::uuid,(data->>'mechId')::uuid,session.id,
    data->>'inputId','Keep the historical response.',
    '{"role":"user","parts":[{"type":"text","text":"Keep the historical response."}]}'::jsonb,
    '{"kind":"console"}'::jsonb,(data->>'createdAt')::timestamptz
  FROM fixture CROSS JOIN session RETURNING id,session_id
),
run AS (
  INSERT INTO mechane.runs(id,workspace_id,mech_id,session_id,input_id,definition_revision,status,created_at,started_at,ended_at)
  SELECT (data->>'runId')::uuid,(data->>'workspaceId')::uuid,(data->>'mechId')::uuid,input.session_id,input.id,
    1,'completed',(data->>'createdAt')::timestamptz,(data->>'createdAt')::timestamptz,(data->>'createdAt')::timestamptz
  FROM fixture CROSS JOIN input RETURNING id,session_id
),
history AS (
  INSERT INTO mechane.messages(id,session_id,run_id,position,ui_message,created_at)
  SELECT (entry->>'id')::uuid,run.session_id,run.id,(entry->>'position')::integer,
    entry->'ui',(entry->>'createdAt')::timestamptz
  FROM fixture CROSS JOIN run CROSS JOIN LATERAL jsonb_array_elements(data->'messages') entry
),
publication AS (
  INSERT INTO mechane.console_messages(id,workspace_id,mech_id,run_id,tool_call_id,role,text,presentation,created_at)
  SELECT (entry->>'id')::uuid,(data->>'workspaceId')::uuid,(data->>'mechId')::uuid,run.id,
    entry->>'toolCallId','assistant',entry->>'text',NULLIF(entry->'presentation','null'::jsonb),
    (entry->>'createdAt')::timestamptz
  FROM fixture CROSS JOIN run
    CROSS JOIN LATERAL jsonb_array_elements(data->'publications') WITH ORDINALITY AS entries(entry,ordinal)
  ORDER BY entries.ordinal RETURNING id,workspace_id,mech_id,run_id,created_at
)
INSERT INTO mechane.activity(id,workspace_id,mech_id,run_id,type,data,created_at)
SELECT (entry->>'activityId')::uuid,publication.workspace_id,publication.mech_id,publication.run_id,'console.message',
  jsonb_build_object('messageId',publication.id::text,'turnId',publication.run_id::text),publication.created_at
FROM fixture CROSS JOIN publication CROSS JOIN LATERAL jsonb_array_elements(data->'publications') entry
WHERE (entry->>'id')::uuid=publication.id;
COMMIT;
`,
  });

  return {
    runId,
    publications,
    sourceDatabaseUrl: sourceDatabaseUrl.href,
    sourceDatabaseName,
    retirementEvidence: {
      version: 1,
      kind: 'frozen-conversation-fixture',
      source: frozen.source,
      database: sourceDatabaseName,
      workspaceId: input.workspaceId,
      mechId: input.mechId,
      executionOwner: 'never-started',
      seededRunStatus: 'completed',
    },
  };
}

async function runFixtureSql(input: FixtureSqlInput): Promise<void> {
  const args = [
    'exec',
    '-i',
    input.container,
    'psql',
    '-U',
    'mechane',
    '-d',
    input.database,
    '--set',
    'ON_ERROR_STOP=1',
  ];

  for (const [name, value] of Record.toEntries(input.variables ?? {})) {
    args.push('--set', `${name}=${value}`);
  }

  await runCommand({ command: 'docker', args, environment: input.environment, input: input.sql });
}

function sourceDatabasePath({ database }: SourceDatabaseAddress): string {
  return `/${encodeURIComponent(database)}`;
}

import { randomUUID } from 'node:crypto';
import { runCommand } from '../../process.ts';
import type { ConversationImport, ConversationImportScope, Environment } from '../../types.ts';

type SeedConversationImport = ConversationImportScope & {
  readonly container: string;
  readonly environment: Environment;
};

const INVALID_SOURCE_ID = '00000000-0000-4000-8000-000000000003';
const VALID_SOURCE_ID = '00000000-0000-4000-8000-000000000002';
const IMPORTED_AT = '2026-11-05T12:00:00.000Z';
const VALID_IMPORTED_AT = '2026-11-05T12:01:00.000Z';
const NATIVE_AT = '2026-11-05T12:02:00.000Z';

export async function seedConversationImport(input: SeedConversationImport): Promise<ConversationImport> {
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

  await runCommand({
    command: 'docker',
    args: [
      'exec',
      '-i',
      input.container,
      'psql',
      '-U',
      'mechane',
      '-d',
      'mechane',
      '--set',
      'ON_ERROR_STOP=1',
      '--set',
      `fixture=${JSON.stringify(fixture)}`,
    ],
    environment: input.environment,
    input: `
BEGIN;
DO $fixture_schema$
BEGIN
  IF (SELECT max(version) FROM mechane.schema_migrations) NOT IN (3,4) THEN
    RAISE EXCEPTION 'The historical Console fixture requires the schema 3 to 4 data-only upgrade';
  END IF;
END;
$fixture_schema$;
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
DELETE FROM mechane.schema_migrations WHERE version=4;
COMMIT;
`,
  });

  return { runId, publications };
}

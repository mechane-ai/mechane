export const DOMAIN_MIGRATIONS = [
  {
    version: 1,
    sql: `
CREATE SCHEMA IF NOT EXISTS mechane;
CREATE TABLE mechane.schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mechane.principals (
  id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.identities (
  provider text NOT NULL CHECK (provider = 'github'), subject text NOT NULL, login text NOT NULL,
  principal_id uuid NOT NULL REFERENCES mechane.principals(id), PRIMARY KEY (provider, subject)
);
CREATE TABLE mechane.workspaces (
  id uuid PRIMARY KEY, name text NOT NULL, creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  personal_owner_id uuid REFERENCES mechane.principals(id),
  daily_cap_micros bigint NOT NULL DEFAULT 50000000 CHECK (daily_cap_micros BETWEEN 0 AND 9007199254740991),
  policy jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.memberships (
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES mechane.principals(id), role text NOT NULL CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, principal_id)
);
CREATE TABLE mechane.oauth_states (
  token_hash text PRIMARY KEY, return_to text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.browser_sessions (
  token_hash text PRIMARY KEY, principal_id uuid NOT NULL REFERENCES mechane.principals(id),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.api_keys (
  id uuid PRIMARY KEY, principal_id uuid NOT NULL REFERENCES mechane.principals(id), token_hash text NOT NULL UNIQUE,
  name text NOT NULL, purpose text NOT NULL CHECK(purpose IN ('login','named')),
  approved_by uuid NOT NULL REFERENCES mechane.principals(id),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.device_approvals (
  id uuid PRIMARY KEY, device_code_hash text NOT NULL UNIQUE, user_code_hash text NOT NULL UNIQUE,
  name text NOT NULL, status text NOT NULL CHECK (status IN ('pending','approved','denied','claimed')),
  purpose text NOT NULL CHECK(purpose IN ('login','named')),
  key_lifetime_seconds integer NOT NULL CHECK(key_lifetime_seconds BETWEEN 1 AND 31536000),
  principal_id uuid REFERENCES mechane.principals(id), api_key_id uuid REFERENCES mechane.api_keys(id),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.auth_attempts (
  bucket text PRIMARY KEY, window_start timestamptz NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL CHECK(attempts > 0)
);
CREATE TABLE mechane.mechs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id), name text NOT NULL,
  model text NOT NULL DEFAULT 'openai/gpt-6.1-sol', instructions text,
  daily_cap_micros bigint NOT NULL DEFAULT 50000000 CHECK (daily_cap_micros BETWEEN 0 AND 9007199254740991),
  status text NOT NULL CHECK (status IN ('active','paused','archived')), revision integer NOT NULL CHECK (revision > 0),
  creation_request_id uuid NOT NULL, creation_fingerprint text NOT NULL, forked_from jsonb,
  creator_id uuid NOT NULL REFERENCES mechane.principals(id), updater_id uuid NOT NULL REFERENCES mechane.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,creation_request_id)
);
CREATE INDEX mechs_workspace_created ON mechane.mechs(workspace_id,created_at,id);
CREATE TABLE mechane.mech_revisions (
  mech_id uuid NOT NULL REFERENCES mechane.mechs(id), revision integer NOT NULL, name text NOT NULL, model text NOT NULL,
  instructions text, daily_cap_micros bigint NOT NULL, status text NOT NULL CHECK (status IN ('active','paused','archived')),
  updater_id uuid NOT NULL REFERENCES mechane.principals(id), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mech_id,revision)
);
CREATE TABLE mechane.sessions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  channel_key text NOT NULL,
  title text NOT NULL DEFAULT 'Conversation', source text NOT NULL CHECK(source IN ('console','slack','api')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  UNIQUE(workspace_id,mech_id,id), UNIQUE(workspace_id,mech_id,channel_key)
);
CREATE TABLE mechane.inputs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL, session_id uuid NOT NULL,
  idempotency_key text NOT NULL, input_text text NOT NULL, input_message jsonb NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]',
  origin jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id,session_id) REFERENCES mechane.sessions(workspace_id,mech_id,id),
  UNIQUE(workspace_id,mech_id,idempotency_key)
);
CREATE TABLE mechane.runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL, session_id uuid NOT NULL,
  input_id uuid NOT NULL UNIQUE REFERENCES mechane.inputs(id), workflow_id text UNIQUE,
  definition_revision integer NOT NULL, status text NOT NULL CHECK(status IN ('queued','running','waiting','completed','failed','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  reply text, error text, failure_reason text CHECK(failure_reason IN ('allowance_exhausted','faulted')), cancel_requested_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz, ended_at timestamptz,
  FOREIGN KEY(workspace_id,mech_id,session_id) REFERENCES mechane.sessions(workspace_id,mech_id,id),
  FOREIGN KEY(mech_id,definition_revision) REFERENCES mechane.mech_revisions(mech_id,revision)
);
CREATE INDEX runs_mech_created ON mechane.runs(mech_id,created_at DESC,id);
CREATE UNIQUE INDEX runs_one_active_per_mech ON mechane.runs(mech_id) WHERE status IN ('running','waiting');
CREATE TABLE mechane.messages (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES mechane.sessions(id), run_id uuid NOT NULL REFERENCES mechane.runs(id),
  position integer NOT NULL CHECK(position >= 0), model_message jsonb, ui_message jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,position),
  CHECK(model_message IS NOT NULL OR ui_message IS NOT NULL)
);
CREATE TABLE mechane.session_contexts (
  session_id uuid PRIMARY KEY REFERENCES mechane.sessions(id), run_id uuid NOT NULL REFERENCES mechane.runs(id),
  summary text NOT NULL, covered_message_count integer NOT NULL CHECK(covered_message_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.activity (
  id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE, workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  run_id uuid REFERENCES mechane.runs(id), type text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE INDEX activity_mech_sequence ON mechane.activity(mech_id,sequence);
CREATE TABLE mechane.memories (
  workspace_id uuid NOT NULL, mech_id uuid NOT NULL, path text NOT NULL, text text NOT NULL, digest text NOT NULL,
  version integer NOT NULL CHECK(version > 0), run_id uuid REFERENCES mechane.runs(id), updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id), PRIMARY KEY(mech_id,path)
);
CREATE TABLE mechane.work_items (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL, title text NOT NULL,
  state text NOT NULL CHECK(state IN ('open','resolved','abandoned')), note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE TABLE mechane.spend_reservations (
  id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES mechane.runs(id), workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  model text NOT NULL, reserved_micros bigint NOT NULL CHECK(reserved_micros BETWEEN 0 AND 9007199254740991),
  settled_micros bigint CHECK(settled_micros BETWEEN 0 AND 9007199254740991), usage jsonb,
  state text NOT NULL CHECK(state IN ('reserved','settled','refused')),
  created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  CHECK((state = 'settled') = (settled_micros IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE INDEX reservations_workspace_day ON mechane.spend_reservations(workspace_id,created_at);
CREATE INDEX reservations_run ON mechane.spend_reservations(run_id,created_at);
CREATE TABLE mechane.credentials (
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id), reference text NOT NULL,
  key_version text NOT NULL, nonce text NOT NULL, ciphertext text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,reference)
);
CREATE TABLE mechane.execution_access (
  workspace_id uuid NOT NULL, mech_id uuid PRIMARY KEY, access jsonb NOT NULL,
  updated_by uuid NOT NULL REFERENCES mechane.principals(id), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE TABLE mechane.mcp_connections (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id), name text NOT NULL,
  url text NOT NULL, secret_reference text, allowed_tools text[] NOT NULL, policy text NOT NULL CHECK(policy = 'read_only_free'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id)
);
CREATE TABLE mechane.mcp_grants (
  workspace_id uuid NOT NULL, mech_id uuid NOT NULL, connection_id uuid NOT NULL, tools text[] NOT NULL,
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  FOREIGN KEY(workspace_id,connection_id) REFERENCES mechane.mcp_connections(workspace_id,id), PRIMARY KEY(mech_id,connection_id)
);
CREATE TABLE mechane.slack_installations (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id), team_id text NOT NULL,
  bot_user_id text NOT NULL, bot_token_reference text NOT NULL, signing_secret_reference text NOT NULL,
  history_token_reference text, api_origin text NOT NULL DEFAULT 'https://slack.com', deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE TABLE mechane.slack_bindings (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, installation_id text NOT NULL, team_id text NOT NULL,
  channel_id text NOT NULL, channel_kind text NOT NULL CHECK(channel_kind IN ('channel','im','mpim')),
  mech_id uuid NOT NULL, is_listening boolean NOT NULL, is_reply_enabled boolean NOT NULL, allowed_user_ids text[],
  FOREIGN KEY(workspace_id,installation_id) REFERENCES mechane.slack_installations(workspace_id,id),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id), UNIQUE(installation_id,channel_id)
);
CREATE TABLE mechane.slack_inbound_events (
  installation_id text NOT NULL REFERENCES mechane.slack_installations(id), event_id text NOT NULL,
  binding_id uuid NOT NULL REFERENCES mechane.slack_bindings(id), payload jsonb NOT NULL,
  input_id uuid REFERENCES mechane.inputs(id), received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(installation_id,event_id)
);
CREATE TABLE mechane.slack_deliveries (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL, run_id uuid REFERENCES mechane.runs(id),
  binding_id uuid NOT NULL REFERENCES mechane.slack_bindings(id), channel_id text NOT NULL, thread_id text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('acknowledgement','reply','notification')),
  status text NOT NULL CHECK(status IN ('pending','sending','delivered','failed','uncertain','blocked')),
  message_id text, content jsonb NOT NULL, content_digest text NOT NULL, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE TABLE mechane.request_events (
  id uuid PRIMARY KEY, service_id text NOT NULL, request_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('access','vend')),
  resolution text NOT NULL CHECK(resolution IN ('ready','denied','expired','cancelled')), approval_id uuid,
  occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), UNIQUE(service_id,kind,request_id)
);
CREATE TABLE mechane.request_waits (
  service_id text NOT NULL, request_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('access','vend')),
  run_id uuid NOT NULL REFERENCES mechane.runs(id), hook_token text NOT NULL UNIQUE,
  service_identity text NOT NULL,
  event_id uuid REFERENCES mechane.request_events(id), delivered_at timestamptz, closed_at timestamptz,
  PRIMARY KEY(service_id,kind,request_id)
);
CREATE TABLE mechane.execution_receipts (
  id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES mechane.runs(id),
  kind text NOT NULL CHECK(kind IN ('sandbox','mcp')),
  status text NOT NULL CHECK(status IN ('pending','running','completed','uncertain','failed')),
  provider_id text, result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mechane.sandbox_capacity (
  workspace_id uuid NOT NULL, mech_id uuid PRIMARY KEY,
  reservation_id bigint NOT NULL CHECK(reservation_id BETWEEN 1 AND 9007199254740991),
  machine_id uuid NOT NULL, state text NOT NULL CHECK(state IN ('held','released')),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE INDEX sandbox_capacity_held ON mechane.sandbox_capacity(workspace_id) WHERE state='held';
CREATE TABLE mechane.audit_events (
  id uuid PRIMARY KEY, workspace_id uuid REFERENCES mechane.workspaces(id),
  principal_id uuid NOT NULL REFERENCES mechane.principals(id), credential_id uuid,
  action text NOT NULL, target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    version: 2,
    sql: `
ALTER TABLE mechane.execution_receipts DROP CONSTRAINT execution_receipts_kind_check;
ALTER TABLE mechane.execution_receipts ADD CONSTRAINT execution_receipts_kind_check
  CHECK(kind IN ('sandbox','mcp','process','browser'));
ALTER TABLE mechane.execution_receipts ADD COLUMN request jsonb;
ALTER TABLE mechane.execution_receipts ADD CONSTRAINT execution_receipts_interactive_request_check
  CHECK(kind NOT IN ('process','browser') OR request IS NOT NULL);
`,
  },
  {
    version: 3,
    sql: `
ALTER TABLE mechane.runs ADD COLUMN notification_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX runs_notifications ON mechane.runs USING gin(notification_ids);
CREATE TABLE mechane.notifications (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  received_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  text text NOT NULL, source jsonb NOT NULL, producer jsonb NOT NULL, producer_key text NOT NULL,
  source_name text NOT NULL, source_event_id text NOT NULL, data jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  UNIQUE(mech_id,producer_key,source_name,source_event_id)
);
CREATE INDEX notifications_mech_sequence ON mechane.notifications(mech_id,received_sequence);
CREATE TABLE mechane.mech_mailboxes (
  mech_id uuid PRIMARY KEY, workspace_id uuid NOT NULL, session_id uuid REFERENCES mechane.sessions(id),
  received_sequence bigint NOT NULL DEFAULT 0 CHECK(received_sequence >= 0),
  presented_sequence bigint NOT NULL DEFAULT 0 CHECK(presented_sequence BETWEEN 0 AND received_sequence),
  active_run_id uuid REFERENCES mechane.runs(id), is_wake_pending boolean NOT NULL DEFAULT false,
  is_environment_checkpoint_required boolean NOT NULL DEFAULT false,
  model_messages jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(model_messages)='array'),
  notes_imported_at timestamptz,
  is_context_initialized boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE TABLE mechane.activation_checkpoints (
  run_id uuid PRIMARY KEY REFERENCES mechane.runs(id),
  start_sequence bigint NOT NULL CHECK(start_sequence >= 0),
  scheduled_sequence bigint NOT NULL CHECK(scheduled_sequence >= start_sequence),
  checkpoint_sequence integer NOT NULL DEFAULT 0 CHECK(checkpoint_sequence >= 0),
  checkpoint_fingerprint text,
  successor_run_id uuid REFERENCES mechane.runs(id)
);
CREATE TABLE mechane.tool_dispatches (
  run_id uuid NOT NULL REFERENCES mechane.runs(id), tool_call_id text NOT NULL, tool_name text NOT NULL,
  presented_sequence bigint NOT NULL CHECK(presented_sequence >= 0),
  status text NOT NULL CHECK(status IN ('admitted','not_started')),
  reason text CHECK(reason IN ('notifications_pending','execution_stopped')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,tool_call_id),
  CHECK((status='not_started')=(reason IS NOT NULL))
);
CREATE TABLE mechane.console_messages (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  run_id uuid REFERENCES mechane.runs(id), notification_id uuid REFERENCES mechane.notifications(id),
  tool_call_id text, role text NOT NULL CHECK(role IN ('user','assistant')), text text NOT NULL, presentation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  UNIQUE(run_id,tool_call_id), UNIQUE(notification_id),
  CHECK((role='assistant' AND run_id IS NOT NULL AND tool_call_id IS NOT NULL AND notification_id IS NULL)
    OR (role='user' AND run_id IS NULL AND tool_call_id IS NULL AND notification_id IS NOT NULL))
);
CREATE INDEX console_messages_mech_sequence ON mechane.console_messages(mech_id,sequence);
INSERT INTO mechane.notifications(id,workspace_id,mech_id,text,source,producer,producer_key,source_name,source_event_id,received_at)
SELECT input.id,input.workspace_id,input.mech_id,input.input_text,
  jsonb_build_object('name','console','eventId',input.id::text),
  jsonb_build_object('kind','member','principalId',input.origin->>'principalId'),
  'member:' || (input.origin->>'principalId'),'console',input.id::text,input.created_at
FROM mechane.inputs input WHERE input.origin->>'kind'='console' ORDER BY input.created_at,input.id;
INSERT INTO mechane.mech_mailboxes(workspace_id,mech_id,received_sequence,presented_sequence)
SELECT workspace_id,mech_id,max(received_sequence),max(received_sequence)
FROM mechane.notifications GROUP BY workspace_id,mech_id;
UPDATE mechane.runs run SET notification_ids=ARRAY[notification.id]
FROM mechane.notifications notification WHERE notification.id=run.input_id;
INSERT INTO mechane.console_messages(id,workspace_id,mech_id,notification_id,run_id,tool_call_id,role,text,presentation,created_at)
SELECT entry.id,entry.workspace_id,entry.mech_id,entry.notification_id,entry.run_id,entry.tool_call_id,
  entry.role,entry.text,entry.presentation,entry.created_at FROM (
  SELECT notification.id,notification.workspace_id,notification.mech_id,notification.id AS notification_id,
    NULL::uuid AS run_id,NULL::text AS tool_call_id,'user'::text AS role,notification.text,NULL::jsonb AS presentation,
    notification.received_at AS created_at,-1 AS position,0::bigint AS part_position
  FROM mechane.notifications notification
  UNION ALL
  SELECT md5(message.id::text || ':' || parts.ordinal::text)::uuid,run.workspace_id,run.mech_id,NULL::uuid,run.id,
    'imported-message:' || message.id::text || ':' || parts.ordinal::text,'assistant',
    CASE WHEN parts.part->>'type'='text' THEN parts.part->>'text' ELSE parts.part->'output'->>'fallback' END,
    CASE WHEN parts.part->>'type'='tool-render_ui' THEN parts.part->'output' ELSE NULL END,
    message.created_at,message.position,parts.ordinal
  FROM mechane.messages message JOIN mechane.runs run ON run.id=message.run_id
    JOIN mechane.inputs input ON input.id=run.input_id
    CROSS JOIN LATERAL jsonb_array_elements(message.ui_message->'parts') WITH ORDINALITY AS parts(part,ordinal)
  WHERE input.origin->>'kind'='console' AND message.ui_message->>'role'='assistant'
    AND ((parts.part->>'type'='text' AND jsonb_typeof(parts.part->'text')='string')
      OR (parts.part->>'type'='tool-render_ui' AND jsonb_typeof(parts.part->'output'->'spec')='object'
        AND jsonb_typeof(parts.part->'output'->'fallback')='string'))
) entry WHERE entry.role='user' OR entry.text<>'' OR entry.presentation IS NOT NULL
ORDER BY entry.created_at,entry.position,entry.part_position,entry.id;
`,
  },
  {
    version: 4,
    sql: `
-- The measured set contains three exact imported publications, so this rewrite fits one transaction.
-- Each UUIDv8 repair leaves the invalid-ID candidate set; repeating the rewrite changes no further rows.
DO $repair_console_ids$
DECLARE
  candidate record;
  identity_bytes bytea;
  repaired_id uuid;
BEGIN
  FOR candidate IN
    SELECT publication.id,publication.workspace_id,publication.mech_id,publication.run_id
    FROM mechane.console_messages publication
      JOIN mechane.messages message ON message.run_id=publication.run_id
      JOIN mechane.runs run ON run.id=message.run_id
      JOIN mechane.inputs input ON input.id=run.input_id
      CROSS JOIN LATERAL jsonb_array_elements(message.ui_message->'parts') WITH ORDINALITY AS parts(part,ordinal)
    WHERE publication.role='assistant' AND publication.workspace_id=run.workspace_id AND publication.mech_id=run.mech_id
      AND input.origin->>'kind'='console' AND message.ui_message->>'role'='assistant'
      AND publication.tool_call_id='imported-message:' || message.id::text || ':' || parts.ordinal::text
      AND publication.id=md5(message.id::text || ':' || parts.ordinal::text)::uuid
      AND ((parts.part->>'type'='text' AND jsonb_typeof(parts.part->'text')='string')
        OR (parts.part->>'type'='tool-render_ui' AND jsonb_typeof(parts.part->'output'->'spec')='object'
          AND jsonb_typeof(parts.part->'output'->'fallback')='string'))
      AND publication.id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND publication.id NOT IN ('00000000-0000-0000-0000-000000000000','ffffffff-ffff-ffff-ffff-ffffffffffff')
    FOR UPDATE OF publication
  LOOP
    identity_bytes := decode(replace(candidate.id::text,'-',''),'hex');
    identity_bytes := set_byte(identity_bytes,6,(get_byte(identity_bytes,6) & 15) | 128);
    identity_bytes := set_byte(identity_bytes,8,(get_byte(identity_bytes,8) & 63) | 128);
    repaired_id := encode(identity_bytes,'hex')::uuid;

    IF EXISTS(SELECT 1 FROM mechane.console_messages WHERE id=repaired_id) THEN
      RAISE EXCEPTION 'Console import ID % cannot become % because the target already exists',candidate.id,repaired_id;
    END IF;

    IF EXISTS(
      SELECT 1 FROM mechane.activity activity
      WHERE activity.type='console.message' AND activity.data->>'messageId'=candidate.id::text
        AND (activity.workspace_id<>candidate.workspace_id OR activity.mech_id<>candidate.mech_id
          OR activity.run_id IS DISTINCT FROM candidate.run_id)
    ) THEN
      RAISE EXCEPTION 'Console import ID % has an activity reference outside its owning activation',candidate.id;
    END IF;

    UPDATE mechane.console_messages SET id=repaired_id WHERE id=candidate.id;
    UPDATE mechane.activity activity SET data=jsonb_set(activity.data,'{messageId}',to_jsonb(repaired_id::text))
    WHERE activity.type='console.message' AND activity.data->>'messageId'=candidate.id::text
      AND activity.workspace_id=candidate.workspace_id AND activity.mech_id=candidate.mech_id
      AND activity.run_id=candidate.run_id;
  END LOOP;
END;
$repair_console_ids$;
`,
  },
  {
    version: 5,
    sql: `
ALTER TABLE mechane.mcp_connections DROP CONSTRAINT mcp_connections_policy_check;
ALTER TABLE mechane.mcp_connections ADD CONSTRAINT mcp_connections_policy_check
  CHECK(policy IN ('read_only_free','idempotent_free'));
`,
  },
  {
    version: 6,
    sql: `
CREATE TABLE mechane.provider_attempts (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL, mech_id uuid NOT NULL,
  activation_id uuid NOT NULL, generation_task_id text, attempt_ordinal integer NOT NULL CHECK(attempt_ordinal > 0),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK(provider <> ''), model text NOT NULL CHECK(model <> ''),
  reserved_micros bigint NOT NULL CHECK(reserved_micros BETWEEN 0 AND 9007199254740991),
  actual_micros bigint CHECK(actual_micros BETWEEN 0 AND 9007199254740991), upstream_usage jsonb,
  state text NOT NULL CHECK(state IN ('reserved','dispatched','settled','released','refused')),
  refusal_reason text CHECK(refusal_reason IN ('workspace_suspended','mech_disabled','workspace_allowance','mech_allowance')),
  accounting_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  created_at timestamptz NOT NULL DEFAULT now(), dispatched_at timestamptz, settled_at timestamptz, released_at timestamptz,
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  CHECK((state = 'settled') = (actual_micros IS NOT NULL AND upstream_usage IS NOT NULL AND settled_at IS NOT NULL)),
  CHECK((state IN ('dispatched','settled')) = (dispatched_at IS NOT NULL)),
  CHECK((state = 'released') = (released_at IS NOT NULL)),
  CHECK((state = 'refused') = (refusal_reason IS NOT NULL))
);
CREATE INDEX provider_attempts_workspace_day ON mechane.provider_attempts(workspace_id,accounting_date,mech_id);
CREATE TABLE mechane.control_changes (
  id uuid PRIMARY KEY, source_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  workspace_id uuid NOT NULL, mech_id uuid NOT NULL, kind text NOT NULL CHECK(kind = 'control.changed'),
  definition_revision integer NOT NULL CHECK(definition_revision > 0), created_at timestamptz NOT NULL DEFAULT now(),
  claim_id uuid, lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
  last_error text CHECK(last_error IN ('recipient_unavailable','delivery_failed')),
  FOREIGN KEY(workspace_id,mech_id) REFERENCES mechane.mechs(workspace_id,id),
  CHECK((claim_id IS NULL) = (lease_until IS NULL))
);
CREATE INDEX control_changes_pending ON mechane.control_changes(next_attempt_at,source_sequence) WHERE delivered_at IS NULL;
`,
  },
  {
    version: 7,
    sql: `
ALTER TABLE mechane.oauth_states ADD COLUMN session_token_hash text;
`,
  },
  {
    version: 8,
    sql: `
ALTER TABLE mechane.mechs ADD COLUMN native_tools text[];
ALTER TABLE mechane.mech_revisions ADD COLUMN native_tools text[];
`,
  },
] as const;

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
] as const;

export const managedUsageMigration = `
ALTER TABLE mechane.provider_attempts
  ADD COLUMN session_id text,
  ADD COLUMN thread_id text,
  ADD COLUMN usage_unconfirmed_at timestamptz,
  ADD COLUMN usage_due_at timestamptz,
  ADD CHECK (usage_unconfirmed_at IS NULL OR usage_due_at IS NOT NULL),
  ADD CHECK (usage_due_at IS NULL OR (state IN ('dispatched','settled') AND session_id IS NOT NULL)),
  ADD COLUMN unsent_dispatch_marked_at timestamptz,
  ADD CHECK (unsent_dispatch_marked_at IS NULL OR (session_id IS NOT NULL AND state='released')),
  ADD COLUMN list_cost_picodollars numeric,
  ADD CHECK ((session_id IS NULL) = (thread_id IS NULL)),
  ADD CHECK (list_cost_picodollars IS NULL OR (state='settled' AND session_id IS NOT NULL)),
  ADD CHECK (list_cost_picodollars >= 0 AND list_cost_picodollars=trunc(list_cost_picodollars)),
  DROP CONSTRAINT provider_attempts_refusal_reason_check;
ALTER TABLE mechane.provider_attempts ADD CHECK (
  refusal_reason IN ('workspace_suspended','mech_disabled','workspace_allowance','mech_allowance','session_budget')
);
CREATE INDEX provider_attempts_managed_activation ON mechane.provider_attempts(workspace_id,mech_id,activation_id,attempt_ordinal DESC) WHERE session_id IS NOT NULL;
CREATE INDEX provider_attempts_managed_session ON mechane.provider_attempts(workspace_id,session_id,thread_id)
  WHERE state IN ('dispatched','settled') AND session_id IS NOT NULL;

CREATE TABLE mechane.managed_usage_activity (
  workspace_id uuid NOT NULL, session_id text NOT NULL, thread_id text NOT NULL, event_id text NOT NULL,
  at timestamptz NOT NULL, running boolean NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(workspace_id,session_id,event_id),
  FOREIGN KEY(workspace_id,session_id) REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX managed_usage_activity_timeline ON mechane.managed_usage_activity(workspace_id,session_id,thread_id,at);
CREATE TABLE mechane.managed_budget_changes (
  revision bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, workspace_id uuid NOT NULL, session_id text NOT NULL,
  previous_cents numeric NOT NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(workspace_id,session_id) REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX managed_budget_timeline ON mechane.managed_budget_changes(workspace_id,session_id,changed_at,revision);
CREATE TABLE mechane.managed_web_searches (
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  workspace_id uuid NOT NULL, session_id text NOT NULL, thread_id text NOT NULL, event_id text NOT NULL,
  PRIMARY KEY(workspace_id,session_id,event_id),
  FOREIGN KEY(workspace_id,session_id) REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE
);
`;

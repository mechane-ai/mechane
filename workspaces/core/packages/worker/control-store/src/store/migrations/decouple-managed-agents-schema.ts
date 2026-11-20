export const decoupleManagedAgentsMigrationSql = `
ALTER TABLE mechane.managed_agents ADD COLUMN daily_cap_micros bigint;
UPDATE mechane.managed_agents agent
SET daily_cap_micros = COALESCE(
  (SELECT legacy.daily_cap_micros FROM mechane.mechs legacy WHERE legacy.workspace_id = agent.workspace_id AND legacy.id = agent.runtime_id),
  (SELECT space.daily_cap_micros FROM mechane.workspaces space WHERE space.id = agent.workspace_id)
)
WHERE agent.daily_cap_micros IS NULL;
ALTER TABLE mechane.managed_agents
  ALTER COLUMN daily_cap_micros SET NOT NULL,
  ADD CHECK (daily_cap_micros BETWEEN 0 AND 9007199254740991);
ALTER TABLE mechane.managed_agents DROP CONSTRAINT IF EXISTS managed_agents_workspace_id_runtime_id_fkey;
ALTER TABLE mechane.managed_sessions DROP CONSTRAINT IF EXISTS managed_sessions_workspace_id_runtime_mech_id_fkey;
ALTER TABLE mechane.provider_attempts DROP CONSTRAINT IF EXISTS provider_attempts_workspace_id_mech_id_fkey;
`;

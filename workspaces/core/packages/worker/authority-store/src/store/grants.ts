import { Schema } from 'effect';
import { Pool } from 'pg';
import { StoredText } from './row-values.ts';

const RoleSchema = Schema.Struct({
  rolname: StoredText,
  is_superuser: Schema.Boolean,
  can_create_database: Schema.Boolean,
  can_create_role: Schema.Boolean,
  can_replicate: Schema.Boolean,
  can_bypass_rls: Schema.Boolean,
  is_current: Schema.Boolean,
});

type GrantInput = { readonly databaseUrl: string; readonly role: string };

const INSTALL_GRANT_FUNCTION = `
CREATE OR REPLACE FUNCTION pg_temp.grant_mechane_control(role_name text) RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),role_name);
  EXECUTE format('GRANT USAGE ON SCHEMA mechane TO %I',role_name);
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA mechane FROM %I',role_name);
  EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA mechane TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE,DELETE ON mechane.principals,mechane.identities,mechane.workspaces,mechane.memberships,mechane.oauth_states,mechane.browser_sessions,mechane.api_keys,mechane.device_approvals,mechane.auth_attempts,mechane.mechs,mechane.credentials,mechane.sandbox_capacity TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE,DELETE ON mechane.managed_command_grants TO %I',role_name);
  EXECUTE format('GRANT INSERT ON mechane.audit_events TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE ON mechane.provider_attempts TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE ON mechane.managed_agents,mechane.managed_skills TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE ON mechane.managed_installed_allocations TO %I',role_name);
  EXECUTE format('GRANT INSERT ON mechane.managed_agent_versions,mechane.managed_skill_versions,mechane.managed_budget_changes,mechane.managed_oidc_identities,mechane.managed_installations,mechane.workspace_service_principals,mechane.managed_usage_activity TO %I',role_name);
  EXECUTE format('GRANT INSERT,DELETE ON mechane.managed_session_mutations,mechane.managed_memory_versions TO %I',role_name);
  EXECUTE format('GRANT UPDATE(path,content,content_sha256,content_size_bytes,redacted_at,redacted_by) ON mechane.managed_memory_versions TO %I',role_name);
  EXECUTE format('GRANT UPDATE(deleted_at) ON mechane.managed_skill_versions TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE,DELETE ON mechane.managed_environments,mechane.managed_environment_keys,mechane.managed_work,mechane.managed_worker_polls,mechane.managed_git_transfers,mechane.managed_sessions,mechane.managed_session_evidence,mechane.managed_memory_stores,mechane.managed_memories,mechane.managed_vaults,mechane.managed_vault_credentials,mechane.managed_session_git_tokens TO %I',role_name);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA mechane FROM %I',role_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA mechane REVOKE INSERT,UPDATE,DELETE ON TABLES FROM %I',role_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA mechane GRANT SELECT ON TABLES TO %I',role_name);

  IF to_regnamespace('workflow') IS NOT NULL THEN
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA workflow FROM %I',role_name);
    EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA workflow FROM %I',role_name);
    EXECUTE format('REVOKE USAGE,UPDATE ON ALL SEQUENCES IN SCHEMA workflow FROM %I',role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA workflow REVOKE INSERT,UPDATE,DELETE ON TABLES FROM %I',role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA workflow REVOKE EXECUTE ON FUNCTIONS FROM %I',role_name);
  END IF;
  IF to_regnamespace('graphile_worker') IS NOT NULL THEN
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA graphile_worker FROM %I',role_name);
    EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA graphile_worker FROM %I',role_name);
    EXECUTE format('REVOKE USAGE,UPDATE ON ALL SEQUENCES IN SCHEMA graphile_worker FROM %I',role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA graphile_worker REVOKE INSERT,UPDATE,DELETE ON TABLES FROM %I',role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA graphile_worker REVOKE EXECUTE ON FUNCTIONS FROM %I',role_name);
  END IF;
END;
$function$`;

export async function grantControlStoreRuntime({ databaseUrl, role }: GrantInput): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const found = await client.query(
        `
        SELECT rolname,rolsuper AS is_superuser,rolcreatedb AS can_create_database,rolcreaterole AS can_create_role,
          rolreplication AS can_replicate,rolbypassrls AS can_bypass_rls,rolname=current_user AS is_current
        FROM pg_roles WHERE rolname=$1`,
        [role],
      );

      if (found.rows.length === 0) {
        throw new Error('The runtime database role does not exist');
      }

      const target = Schema.decodeUnknownSync(RoleSchema)(found.rows[0]);

      const hasElevatedPrivileges = target.is_superuser || target.can_bypass_rls;
      const canManageDatabase = target.can_create_database || target.can_create_role || target.can_replicate;

      if (target.is_current || hasElevatedPrivileges || canManageDatabase) {
        throw new Error('The runtime database role must be distinct and unprivileged');
      }

      await client.query(INSTALL_GRANT_FUNCTION);
      await client.query('SELECT pg_temp.grant_mechane_control($1)', [role]);

      const rights = await client.query(
        `
        SELECT has_schema_privilege($1,'public','CREATE') OR has_schema_privilege($1,'mechane','CREATE') AS can_create`,
        [role],
      );

      const checked = Schema.decodeUnknownSync(Schema.Struct({ can_create: Schema.Boolean }))(rights.rows[0]);

      if (checked.can_create) {
        throw new Error('The runtime database role inherits schema creation privileges');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

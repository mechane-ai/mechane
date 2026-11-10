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
  EXECUTE format('GRANT INSERT,UPDATE,DELETE ON mechane.principals,mechane.identities,mechane.workspaces,mechane.memberships,mechane.oauth_states,mechane.browser_sessions,mechane.api_keys,mechane.device_approvals,mechane.auth_attempts,mechane.mechs,mechane.credentials,mechane.execution_access,mechane.mcp_connections,mechane.mcp_grants,mechane.sandbox_capacity TO %I',role_name);
  EXECUTE format('GRANT INSERT ON mechane.mech_revisions,mechane.audit_events TO %I',role_name);
  EXECUTE format('GRANT INSERT,UPDATE ON mechane.provider_attempts,mechane.control_changes TO %I',role_name);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA mechane FROM %I',role_name);
  EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE mechane.control_changes_source_sequence_seq TO %I',role_name);
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

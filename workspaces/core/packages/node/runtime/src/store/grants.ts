import { Schema } from 'effect';
import { Pool } from 'pg';

const RoleSchema = Schema.Struct({
  rolname: Schema.String,
  is_superuser: Schema.Boolean,
  can_create_database: Schema.Boolean,
  can_create_role: Schema.Boolean,
  can_replicate: Schema.Boolean,
  can_bypass_rls: Schema.Boolean,
  is_current: Schema.Boolean,
});

type GrantInput = { readonly databaseUrl: string; readonly role: string };

const INSTALL_GRANT_FUNCTION = `
CREATE OR REPLACE FUNCTION pg_temp.grant_mechane_runtime(role_name text) RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),role_name);
  EXECUTE format('GRANT USAGE ON SCHEMA mechane,chat,workflow,graphile_worker TO %I',role_name);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA mechane,chat,workflow,graphile_worker TO %I',role_name);
  EXECUTE format('REVOKE ALL ON mechane.schema_migrations FROM %I',role_name);
  EXECUTE format('GRANT SELECT ON mechane.schema_migrations TO %I',role_name);
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON graphile_worker.migrations FROM %I',role_name);
  EXECUTE format('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA mechane,chat,workflow,graphile_worker TO %I',role_name);
  REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA workflow,graphile_worker FROM PUBLIC;
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA workflow,graphile_worker TO %I',role_name);
  DROP POLICY IF EXISTS mechane_runtime_access ON graphile_worker._private_job_queues;
  DROP POLICY IF EXISTS mechane_runtime_access ON graphile_worker._private_jobs;
  DROP POLICY IF EXISTS mechane_runtime_access ON graphile_worker._private_known_crontabs;
  DROP POLICY IF EXISTS mechane_runtime_access ON graphile_worker._private_tasks;
  EXECUTE format('CREATE POLICY mechane_runtime_access ON graphile_worker._private_job_queues TO %I USING(true) WITH CHECK(true)',role_name);
  EXECUTE format('CREATE POLICY mechane_runtime_access ON graphile_worker._private_jobs TO %I USING(true) WITH CHECK(true)',role_name);
  EXECUTE format('CREATE POLICY mechane_runtime_access ON graphile_worker._private_known_crontabs TO %I USING(true) WITH CHECK(true)',role_name);
  EXECUTE format('CREATE POLICY mechane_runtime_access ON graphile_worker._private_tasks TO %I USING(true) WITH CHECK(true)',role_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA mechane,chat,workflow,graphile_worker GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO %I',role_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA mechane,chat,workflow,graphile_worker GRANT USAGE,SELECT ON SEQUENCES TO %I',role_name);
  ALTER DEFAULT PRIVILEGES IN SCHEMA workflow,graphile_worker REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA workflow,graphile_worker GRANT EXECUTE ON FUNCTIONS TO %I',role_name);
END;
$function$`;

export async function grantStoreRuntime({ databaseUrl, role }: GrantInput): Promise<void> {
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
      await client.query('SELECT pg_temp.grant_mechane_runtime($1)', [role]);

      const rights = await client.query(
        `
        SELECT has_schema_privilege($1,'public','CREATE') OR has_schema_privilege($1,'mechane','CREATE')
          OR has_schema_privilege($1,'workflow','CREATE') OR has_schema_privilege($1,'chat','CREATE')
          OR has_schema_privilege($1,'graphile_worker','CREATE') AS can_create`,
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

import { Redacted } from 'effect';
import { requiredSetting } from './environment.ts';

type MigrationSettings = { readonly databaseUrl: Redacted.Redacted };
type GrantSettings = MigrationSettings & { readonly role: string };

export function loadMigrationSettings(): MigrationSettings {
  const databaseUrl = requiredSetting({ name: 'MECHANE_MIGRATION_DATABASE_URL' });

  return { databaseUrl: Redacted.make(databaseUrl) };
}

export function loadGrantSettings(): GrantSettings {
  const migration = loadMigrationSettings();
  const role = requiredSetting({ name: 'MECHANE_RUNTIME_DATABASE_ROLE' });

  return { ...migration, role };
}

import { Redacted } from 'effect';
import type { SettingsEnvironment } from './environment.ts';
import { processEnvironment, requiredSetting } from './environment.ts';

type DatabaseSettingsInput = { readonly environment?: SettingsEnvironment };

type MigrationSettings = { readonly databaseUrl: Redacted.Redacted };
type GrantSettings = MigrationSettings & { readonly role: string };

export function loadMigrationSettings({
  environment = processEnvironment(),
}: DatabaseSettingsInput = {}): MigrationSettings {
  const databaseUrl = requiredSetting({ environment, name: 'MECHANE_MIGRATION_DATABASE_URL' });

  return { databaseUrl: Redacted.make(databaseUrl) };
}

export function loadGrantSettings({ environment = processEnvironment() }: DatabaseSettingsInput = {}): GrantSettings {
  const migration = loadMigrationSettings({ environment });
  const role = requiredSetting({ environment, name: 'MECHANE_RUNTIME_DATABASE_ROLE' });

  return { ...migration, role };
}

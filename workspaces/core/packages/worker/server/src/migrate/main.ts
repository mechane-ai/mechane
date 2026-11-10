import { migrateControlStore } from '@mechane/control-store';
import { Redacted } from 'effect';
import { loadMigrationSettings } from '../settings/database.ts';

async function main(): Promise<void> {
  const settings = loadMigrationSettings();

  await migrateControlStore({ databaseUrl: Redacted.value(settings.databaseUrl) });
}

await main();

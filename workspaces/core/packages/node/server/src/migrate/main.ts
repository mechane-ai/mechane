import { migrateStore } from '@mechane/runtime';
import { Redacted } from 'effect';
import { loadMigrationSettings } from '../settings/database.ts';

async function main(): Promise<void> {
  const settings = loadMigrationSettings();

  await migrateStore({ databaseUrl: Redacted.value(settings.databaseUrl) });
}

await main();

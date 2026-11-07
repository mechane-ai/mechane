import { grantStoreRuntime } from '@mechane/runtime';
import { Redacted } from 'effect';
import { loadGrantSettings } from '../settings/database.ts';

async function main(): Promise<void> {
  const settings = loadGrantSettings();

  await grantStoreRuntime({ databaseUrl: Redacted.value(settings.databaseUrl), role: settings.role });
}

await main();

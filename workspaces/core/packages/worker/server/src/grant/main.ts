import { grantControlStoreRuntime } from '@mechane/control-store';
import { Redacted } from 'effect';
import { loadGrantSettings } from '../settings/database.ts';

async function main(): Promise<void> {
  const settings = loadGrantSettings();

  await grantControlStoreRuntime({ databaseUrl: Redacted.value(settings.databaseUrl), role: settings.role });
}

await main();

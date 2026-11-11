import { ServiceOrigin } from '@mechane/deployment';
import { Redacted, Schema } from 'effect';
import { loadMigrationSettings } from '../settings/database.ts';
import { requiredSetting } from '../settings/environment.ts';
import type { SettingsEnvironment } from '../settings/environment.ts';
import { parseImportArguments } from './arguments.ts';
import { HistoryImportFailed } from './errors.ts';

const COMMAND_ARGUMENT_OFFSET = 2;

type ImportTarget = { readonly origin: URL; readonly serviceKey: Redacted.Redacted };
type LoadImportSettingsInput = { readonly environment: SettingsEnvironment; readonly mode: 'dry-run' | 'apply' };

export function loadImportSettings({ environment, mode }: LoadImportSettingsInput) {
  const migration = loadMigrationSettings({ environment });

  if (mode === 'dry-run') {
    return { ...migration, target: null };
  }

  const origin = Schema.decodeUnknownResult(ServiceOrigin)(environment['MECHANE_ORIGIN']);

  if (origin._tag === 'Failure') {
    throw new HistoryImportFailed({
      reason: 'MECHANE_ORIGIN must be a bare HTTPS origin or a loopback HTTP origin with a port',
    });
  }

  const serviceKey = requiredSetting({ environment, name: 'MECHANE_SANDBOX_SERVICE_KEY' });
  const target: ImportTarget = { origin: origin.success, serviceKey: Redacted.make(serviceKey) };

  return { ...migration, target };
}

export function loadImportCommand() {
  return {
    invocation: parseImportArguments({ arguments: process.argv.slice(COMMAND_ARGUMENT_OFFSET) }),
    environment: process.env,
  };
}

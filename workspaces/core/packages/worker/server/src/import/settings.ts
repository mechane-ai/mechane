import { Redacted } from 'effect';
import { loadMigrationSettings } from '../settings/database.ts';
import { requiredSetting } from '../settings/environment.ts';
import type { SettingsEnvironment } from '../settings/environment.ts';
import { parseImportArguments } from './arguments.ts';
import { HistoryImportFailed } from './errors.ts';

const COMMAND_ARGUMENT_OFFSET = 2;
const ORIGIN_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

type ImportTarget = { readonly origin: URL; readonly serviceKey: Redacted.Redacted };
type LoadImportSettingsInput = { readonly environment: SettingsEnvironment; readonly mode: 'dry-run' | 'apply' };

export function loadImportSettings({ environment, mode }: LoadImportSettingsInput) {
  const migration = loadMigrationSettings({ environment });

  if (mode === 'dry-run') {
    return { ...migration, target: null };
  }

  const value = requiredSetting({ environment, name: 'MECHANE_ORIGIN' });
  const origin = new URL(value);

  const hasCredentials = origin.username !== '' || origin.password !== '';
  const hasOriginSuffix = origin.pathname !== '/' || origin.search !== '' || origin.hash !== '';

  if (!ORIGIN_PROTOCOLS.has(origin.protocol) || hasCredentials || hasOriginSuffix) {
    throw new HistoryImportFailed({
      reason: 'MECHANE_ORIGIN must be an HTTP origin without credentials, a path, or a query',
    });
  }

  const serviceKey = requiredSetting({ environment, name: 'MECHANE_SANDBOX_SERVICE_KEY' });
  const target: ImportTarget = { origin, serviceKey: Redacted.make(serviceKey) };

  return { ...migration, target };
}

export function loadImportCommand() {
  return {
    invocation: parseImportArguments({ arguments: process.argv.slice(COMMAND_ARGUMENT_OFFSET) }),
    environment: process.env,
  };
}

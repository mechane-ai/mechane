import { Redacted } from 'effect';
import { loadRuntimeConfiguration } from '../config.ts';
import { openStore } from './database.ts';
import type { RuntimeStore } from './database.ts';

export async function withRuntimeStore<Result>(operation: (store: RuntimeStore) => Promise<Result>): Promise<Result> {
  const configuration = loadRuntimeConfiguration();

  const store = await openStore({
    databaseUrl: Redacted.value(configuration.databaseUrl),
    keyring: Redacted.value(configuration.credentialKeyring),
    maxConnections: configuration.maxConnections,
  });

  try {
    return await operation(store);
  } finally {
    await store.close();
  }
}

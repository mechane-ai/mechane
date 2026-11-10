import { readText } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { APPLICATION_WORKER_MIGRATIONS } from '@mechane/deployment';
import { sha256Hex } from '@mechane/program';
import type { Lock } from '@mechane/program';
import { Effect, Record } from 'effect';
import { storeHashes } from './store-hashes.ts';

/** Product schema steps retain their original lock namespace after moving the control owner. */
const STORE_MIGRATIONS = {
  Runtime: { path: 'packages/worker/control-store/src/store/schema.ts', declaration: 'DOMAIN_MIGRATIONS' },
  SandboxObject: { path: 'packages/worker/sandbox-store/src/migrations.ts', declaration: 'MIGRATIONS' },
} as const;

/** The migration lock's key for the Wrangler migrations, each under its position, its tag and its entry's hash. */
const WRANGLER_KEY = 'wrangler';

/** A store's class, and the entry of each of its schema steps. */
type StoreEntry = readonly [string, ReadonlyArray<string>];

type StoreEntryInput = { readonly store: string; readonly path: string; readonly declaration: string };

/**
 * Each schema step that will run in production, as the source declares it now. A store's `MIGRATIONS` entry stands
 * under its class by its position and the hash of what it does, and a Wrangler migration by its position, tag and hash.
 * An inserted or reordered step so fails as one the lock lost.
 */
export const migrationHashes = Effect.fn('migrationHashes')(function* (): Effect.fn.Return<Lock, InputUnreadable> {
  const stores = yield* Effect.forEach(
    Record.toEntries(STORE_MIGRATIONS),
    ([store, { path, declaration }]) => storeEntry({ store, path, declaration }),
    { concurrency: 1 },
  );

  const migrations = APPLICATION_WORKER_MIGRATIONS;

  /** A Wrangler migration's entry: its position, its tag and the hash of the whole entry. */
  const tagEntry: (migration: (typeof APPLICATION_WORKER_MIGRATIONS)[number], index: number) => string = (
    migration,
    index,
  ) => `${index} ${migration.tag} ${sha256Hex({ contents: JSON.stringify(migration) })}`;

  return { ...Record.fromEntries(stores), [WRANGLER_KEY]: migrations.map(tagEntry) };
});

/** Each store's declared migration steps keep their own lock namespace. */
const storeEntry = Effect.fn('storeEntry')(function* ({
  store,
  path,
  declaration,
}: StoreEntryInput): Effect.fn.Return<StoreEntry, InputUnreadable> {
  const text = yield* readText({ path });

  return [store, storeHashes({ path, text, declaration })];
});

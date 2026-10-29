import type { MechMemory } from '@mechane/harness-tools';
import type { MechStore, MechTables, SavedMemoryRow, TurnMemoryRow } from '@mechane/mech-store';
import { Option } from 'effect';
import { decideMemoryChange } from './decide-memory-change.ts';
import { readMemoryBound } from './read-memory-bound.ts';

/** The store the mech's memory port reads and changes. */
type MechMemoryInput = { readonly store: MechStore };

/**
 * The mech's memory in its own tables, beside pi's on the database client they share, so a reset or a compaction of the
 * conversation never touches it. Each call is one transaction queued behind every pi commit before it. A drone reads
 * only memory saved through the version it started at, so neither the running turn's changes nor a later save reach
 * it.
 */
export function mechMemory({ store }: MechMemoryInput): MechMemory {
  const listSaved: MechMemory['listSaved'] = async ({ role }) => {
    const list: (tables: MechTables) => ReadonlyArray<SavedMemoryRow> = (tables) =>
      tables.savedMemories({ throughVersion: readMemoryBound({ store: tables, role }) });

    return await store.atomic({ run: list });
  };

  const read: MechMemory['read'] = async ({ path, role }) => {
    const readMemory: (tables: MechTables) => Option.Option<TurnMemoryRow> = (tables) =>
      Option.match(readMemoryBound({ store: tables, role }), {
        onNone: () => tables.turnMemory({ path }),
        onSome: (throughVersion) => tables.savedMemory({ path, throughVersion }),
      });

    const memory = await store.atomic({ run: readMemory });

    if (Option.isNone(memory)) {
      return Option.none();
    }

    const { text, digest, version } = memory.value;

    return Option.some({ text, digest, isSaved: Option.isSome(version) });
  };

  const change: MechMemory['change'] = async (memoryChange) =>
    await store.atomic({ run: (tables) => decideMemoryChange({ store: tables, change: memoryChange }) });

  return { listSaved, read, change };
}

import type { Option } from 'effect';
import type { ConversationRole } from '../types.ts';
import type { MemoryChange, MemoryChangeOutcome } from './schemas.ts';

type RoleInput = { readonly role: ConversationRole };

/** A saved memory, as the memory section lists it. */
export type SavedMemory = { readonly path: string; readonly text: string };

/** The memory at a path as the running turn sees it: saved, or held by the turn's own change. */
export type TurnMemory = { readonly text: string; readonly digest: string; readonly isSaved: boolean };

export type PathInput = { readonly path: string };

/** Why a change is refused, which records nothing. */
export type MemoryRefusal = (typeof MemoryChangeOutcome.cases)['Exists' | 'Changed' | 'Missing' | 'Full']['Type'];

/**
 * A mech's memory as the harness's tools and section reach it, by the role of the conversation that reads. A drone
 * reads it as saved when the drone started, and only the mech changes it. No pi type crosses it.
 */
export type MechMemory = {
  readonly listSaved: (input: RoleInput) => Promise<ReadonlyArray<SavedMemory>>;
  /** The memory at the path as the conversation sees it; none when the path holds none. */
  readonly read: (input: ReadMemoryInput) => Promise<Option.Option<TurnMemory>>;
  readonly change: (input: MemoryChange) => Promise<MemoryChangeOutcome>;
};

export type ReadMemoryInput = PathInput & RoleInput;

export type MemoryInput = { readonly memory: MechMemory };

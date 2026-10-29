import type { TurnId } from '@mechane/records';
import type { DateTime, Option } from 'effect';
import type { RecordedChangeRow, SavedMemoryRow, TurnMemoryRow } from './memory.schemas.ts';
import type { TaskIdInput } from './task.types.ts';

/** The path of a memory a record function reads. */
export type PathInput = { readonly path: string };

/** One memory tool call's write under its pi task: the path it writes, and the text with its digest. */
export type RecordMemoryWriteInput = {
  readonly taskId: number;
  readonly path: string;
  readonly text: string;
  readonly digest: string;
};

/** One memory tool call's deletion under its pi task: the path it deletes. */
export type RecordMemoryDeletionInput = { readonly taskId: number; readonly path: string };

/** A turn whose pending changes its end saves, and when. */
export type SaveMemoryChangesInput = { readonly turnId: string; readonly now: DateTime.Utc };

/** A turn whose pending changes its end discards. */
export type DiscardMemoryChangesInput = { readonly turnId: TurnId };

/** The newest saved version a read may see. */
export type SavedMemoriesInput = {
  /** Absent for the newest of all; only a drone's read bounds it. */
  readonly throughVersion: Option.Option<number>;
};

/** A path as a drone reads it: its memory saved through the drone's version. */
export type SavedMemoryInput = { readonly path: string; readonly throughVersion: number };

/** The record functions of a mech's memory, one change per row. */
export type MemoryRecords = {
  /** The change a memory tool task recorded, which a rerun of the task answers from. */
  readonly recordedChange: (input: TaskIdInput) => Option.Option<RecordedChangeRow>;
  /** The memory at a path as the running turn sees it: its own newest change, else the saved memory. */
  readonly turnMemory: (input: PathInput) => Option.Option<TurnMemoryRow>;
  /** How many paths hold a memory as the running turn sees them. */
  readonly turnMemoryCount: () => number;
  /** Records a pending write under the running turn, which the statement reads. */
  readonly recordMemoryWrite: (input: RecordMemoryWriteInput) => void;
  /** Records a pending deletion under the running turn, which the statement reads. */
  readonly recordMemoryDeletion: (input: RecordMemoryDeletionInput) => void;
  /** The saved memories by path: what the replies of the mech's turns saved, through a version if one is given. */
  readonly savedMemories: (input: SavedMemoriesInput) => ReadonlyArray<SavedMemoryRow>;
  /** The memory saved at a path through a version, as a drone that started at that version reads it. */
  readonly savedMemory: (input: SavedMemoryInput) => Option.Option<TurnMemoryRow>;
  /** Saves a turn's pending changes, as that turn ends with a reply. */
  readonly saveMemoryChanges: (input: SaveMemoryChangesInput) => void;
  /** Discards a turn's pending changes, as that turn ends without a reply. */
  readonly discardMemoryChanges: (input: DiscardMemoryChangesInput) => void;
};

import type { CopyRows, Sequence } from '@mechane/records';
import type { DateTime, Option } from 'effect';
import type { CopyRow, ForkRow } from './schemas.ts';

/** A fork to record as the mech made it. */
export type RecordForkInput = { readonly fork: ForkRow };

/** A fork whose copy ended, and the sequence of the mech's last event its copy holds. */
export type RecordCopyInput = { readonly forkId: string; readonly sequence: Sequence };

/** A fork whose new mech its workspace indexed, and when. */
export type EndForkInput = { readonly forkId: string; readonly now: DateTime.Utc };

/** When the object began to receive a fork's copy. */
export type BeginCopyInput = { readonly now: DateTime.Utc };

/** The table a page of a copy reads, and the rowid its rows follow, 0 for the table's first page. */
export type CopyPageInput = { readonly table: string; readonly afterRowid: number };

/** A page of a copy, and where the table's next page starts. */
export type CopyPage = CopyRows<SqlStorageValue> & {
  /** The rowid the table's next page follows, absent once the page ended the table. */
  readonly next: Option.Option<number>;
};

/** The record functions of the forks a mech made, and of the copy it receives as a fork. */
export type ForkRecords = {
  /** The fork the mech began and has not ended, none when every fork it made has its mech. */
  readonly openFork: () => Option.Option<ForkRow>;
  /** Records a fork once, so the retry of an open one keeps its first id, name, requester and time. */
  readonly recordFork: (input: RecordForkInput) => void;
  /** Records that the new mech holds its copy, so a retry indexes it without copying again. */
  readonly recordCopy: (input: RecordCopyInput) => void;
  /** Records that the fork's new mech is indexed, which ends the fork. */
  readonly endFork: (input: EndForkInput) => void;
  /** Marks the object as receiving a fork's copy from its parent, until the copy's end. */
  readonly beginCopy: (input: BeginCopyInput) => void;
  /** The copy the object receives, none when it received a whole copy or none; its next open deletes a part. */
  readonly copy: () => Option.Option<CopyRow>;
  /** Unmarks the copy once it ended. */
  readonly endCopy: () => void;
};

/** The record functions of a copy, which moves every table but the mech's identity a page at a time. */
export type CopyRecords = {
  /** Every table a copy moves, each after the tables its foreign keys name. */
  readonly copiedTables: () => ReadonlyArray<string>;
  /** The rows of a table after a rowid, in rowid order, as many as fit a page. */
  readonly copyPage: (input: CopyPageInput) => CopyPage;
  /** Writes the rows a copy moved, each in place of a row the object holds under the same key. */
  readonly writeCopyRows: (input: CopyRows<SqlStorageValue>) => void;
};

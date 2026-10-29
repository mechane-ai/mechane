import type { AddedStatement, DroppedName, UnitStatement } from '@mechane/modules';

/** What a round changes in one file, before the changes become edits. */
export type FileRewrite = {
  readonly dropped: ReadonlyArray<DroppedName>;
  readonly added: ReadonlyArray<AddedStatement>;
  readonly removed: ReadonlyArray<UnitStatement>;
  readonly inserted: ReadonlyArray<Insertion>;
};

/** A moved unit's text, and the offset whose line it lands after. */
export type Insertion = { readonly offset: number; readonly text: string };

/** The names a file's statements drop and the statements it adds, for one statement that takes a moved unit. */
export type PathRewrite = {
  readonly path: string;
  readonly dropped: ReadonlyArray<DroppedName>;
  readonly added: ReadonlyArray<AddedStatement>;
};

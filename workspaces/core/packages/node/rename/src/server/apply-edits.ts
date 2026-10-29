import { Array, Effect, Record } from 'effect';
import type { FileFailed } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import { writeText } from '../files/write-text.ts';
import type { TextEdit } from '../schemas.ts';
import type { FileEdit, LanguageServer } from '../types.ts';
import { editText } from './edit-text.ts';
import { syncDocument } from './sync-document.ts';

/** The language server, and every file's edits. */
type ApplyEditsInput = { readonly server: LanguageServer; readonly edits: ReadonlyArray<FileEdit> };

/** The language server, one file by its absolute path, and its edits. */
type ApplyFileEditsInput = {
  readonly server: LanguageServer;
  readonly path: string;
  readonly edits: ReadonlyArray<TextEdit>;
};

/** Writes each file's edits, and gives the server the new text, so the next rename reads the file as it is now. */
export const applyEdits = Effect.fn('applyEdits')(function* ({
  server,
  edits,
}: ApplyEditsInput): Effect.fn.Return<void, FileFailed> {
  /** Applies one file's edits. */
  const appliedFile: (group: readonly [string, ReadonlyArray<FileEdit>]) => Effect.Effect<void, FileFailed> = ([
    path,
    fileEdits,
  ]) => applyFileEdits({ server, path, edits: fileEdits.map(({ edit }) => edit) });

  yield* Effect.forEach(Record.toEntries(Array.groupBy(edits, ({ path }) => path)), appliedFile, {
    discard: true,
    concurrency: 1,
  });
});

/** Writes one file's edits, and gives the server its new text. */
const applyFileEdits = Effect.fn('applyFileEdits')(function* ({
  server,
  path,
  edits,
}: ApplyFileEditsInput): Effect.fn.Return<void, FileFailed> {
  const text = editText({ text: yield* readText({ path }), edits });

  yield* writeText({ path, text });
  yield* syncDocument({ server, path, text });
});

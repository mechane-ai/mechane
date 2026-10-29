import { Effect, Option, Record, Schema } from 'effect';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { FileFailed, ServerExited } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import { TextEdit } from '../schemas.ts';
import type { FileEdit, LanguageServer, Site } from '../types.ts';
import { request } from './request.ts';
import { syncDocument } from './sync-document.ts';

/** The language server, the site of an identifier, and its new name. */
type RenameAtInput = { readonly server: LanguageServer; readonly site: Site; readonly to: string };

/** The edits of a rename's answer that renames something, by the URI of each file. */
const RenameChanges = Schema.Struct({ changes: Schema.Record(Schema.String, Schema.Array(TextEdit)) });

type RenameChanges = typeof RenameChanges.Type;

/** A rename's answer: each document's edits by its URI, or none where nothing can be renamed. */
const RenameAnswer = Schema.OptionFromNullOr(RenameChanges);

/**
 * The edits that rename the identifier at the site everywhere its program sees it, or none where the server renames
 * nothing, such as a comment or another word.
 */
export const renameAt = Effect.fn('renameAt')(function* ({
  server,
  site,
  to,
}: RenameAtInput): Effect.fn.Return<Option.Option<ReadonlyArray<FileEdit>>, FileFailed | ServerExited> {
  const { path, line, character } = site;

  yield* syncDocument({ server, path, text: yield* readText({ path }) });

  const answered = yield* request({
    server,
    method: 'textDocument/rename',
    params: { textDocument: { uri: pathToFileURL(path).href }, position: { line, character }, newName: to },
  });

  if ('refusal' in answered) {
    return Option.none();
  }

  return Option.map(Schema.decodeUnknownSync(RenameAnswer)(answered.result), fileEdits);
});

/** Each edit of a rename's answer, by the absolute path of its file. */
function fileEdits({ changes }: RenameChanges): ReadonlyArray<FileEdit> {
  /** One document's edits, by its file's absolute path. */
  const documentEdits: (document: readonly [string, ReadonlyArray<TextEdit>]) => ReadonlyArray<FileEdit> = ([
    uri,
    edits,
  ]) => {
    const path = fileURLToPath(uri);

    return edits.map((edit) => ({ path, edit }));
  };

  return Record.toEntries(changes).flatMap(documentEdits);
}

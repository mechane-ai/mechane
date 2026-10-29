import { Effect, Option, Ref } from 'effect';
import { pathToFileURL } from 'node:url';
import type { LanguageServer } from '../types.ts';
import { notify } from './notify.ts';

/** The language server, a file by its absolute path, and its text. */
type SyncDocumentInput = { readonly server: LanguageServer; readonly path: string; readonly text: string };

/**
 * Gives the server a document's text: it opens the document the first time, and replaces its text after, so every
 * rename reads the file as the earlier renames left it.
 */
export const syncDocument = Effect.fn('syncDocument')(function* ({
  server,
  path,
  text,
}: SyncDocumentInput): Effect.fn.Return<void> {
  const uri = pathToFileURL(path).href;

  /** The document's next version, and the versions with it. */
  const nextVersion: (versions: ReadonlyMap<string, number>) => readonly [number, ReadonlyMap<string, number>] = (
    versions,
  ) => {
    const next = Option.getOrElse(Option.fromNullishOr(versions.get(uri)), () => 0) + 1;

    return [next, new Map([...versions, [uri, next]])];
  };

  const version = yield* Ref.modify(server.versions, nextVersion);

  if (version === 1) {
    notify({
      server,
      method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId: 'typescript', version, text } },
    });

    return;
  }

  notify({
    server,
    method: 'textDocument/didChange',
    params: { textDocument: { uri, version }, contentChanges: [{ text }] },
  });
});

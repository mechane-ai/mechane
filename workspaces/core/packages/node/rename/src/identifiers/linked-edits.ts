import { Effect, Option } from 'effect';
import type { FileFailed, ServerExited } from '../errors.ts';
import { editKey } from '../server/edit-key.ts';
import { renameAt } from '../server/rename-at.ts';
import type { FileEdit, LanguageServer, Site } from '../types.ts';

/** One more site where a rename may start, and the edits accepted so far, which a rename joins when it shares one. */
type LinkedEditsInput = {
  readonly server: LanguageServer;
  readonly site: Site;
  readonly to: string;
  readonly accepted: ReadonlyArray<FileEdit>;
};

/** The edits accepted so far, their keys, and the edits of a rename that may join them. */
type JoinedEditsInput = {
  readonly accepted: ReadonlyArray<FileEdit>;
  readonly renamed: ReadonlyArray<FileEdit>;
  readonly keys: ReadonlySet<string>;
};

/** The accepted edits, joined by a rename from the site when that rename shares an edit with them. */
export const linkedEdits = Effect.fn('linkedEdits')(function* ({
  server,
  site,
  to,
  accepted,
}: LinkedEditsInput): Effect.fn.Return<ReadonlyArray<FileEdit>, FileFailed | ServerExited> {
  const keys = new Set(accepted.map((edit) => editKey(edit)));

  if (keys.has(editKey({ path: site.path, edit: { range: { start: site, end: site }, newText: to } }))) {
    return accepted;
  }

  const renamed = yield* renameAt({ server, site, to });

  return joinedEdits({ accepted, renamed: Option.getOrElse(renamed, () => []), keys });
});

/** The accepted edits and a rename's others, when it shares an edit with them, such as a shorthand key both rename. */
function joinedEdits({ accepted, renamed, keys }: JoinedEditsInput): ReadonlyArray<FileEdit> {
  /** Whether the accepted edits hold the edit. */
  const isAccepted: (edit: FileEdit) => boolean = (edit) => keys.has(editKey(edit));

  /** Whether the accepted edits lack the edit. */
  const isUnaccepted: (edit: FileEdit) => boolean = (edit) => !keys.has(editKey(edit));

  if (!renamed.some(isAccepted)) {
    return accepted;
  }

  return [...accepted, ...renamed.filter(isUnaccepted)];
}

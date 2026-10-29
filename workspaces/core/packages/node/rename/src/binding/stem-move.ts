import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import { identifierWords, spellsStem } from '@mechane/program';
import { Effect, Option } from 'effect';
import { basename, dirname, join } from 'node:path';
import { MoveTaken } from '../errors.ts';
import type { BindingRename, FileMove } from '../types.ts';

/** The binding, its file relative to the workspace, and the absolute path of every TypeScript file of the workspace. */
type StemMoveInput = { readonly binding: BindingRename; readonly file: string; readonly files: ReadonlyArray<string> };

/** The move of the file named for the binding to the stem of its new name; none for a file named otherwise. */
export const stemMove = Effect.fn('stemMove')(function* ({
  binding,
  file,
  files,
}: StemMoveInput): Effect.fn.Return<Option.Option<FileMove>, MoveTaken> {
  if (!spellsStem({ name: binding.from, stem: basename(file, TYPESCRIPT_EXTENSION) })) {
    return Option.none();
  }

  const to = join(dirname(file), `${identifierWords({ identifier: binding.to }).join('-')}${TYPESCRIPT_EXTENSION}`);

  if (files.includes(join(WORKSPACE_FOLDER, to))) {
    return yield* new MoveTaken({ from: file, to });
  }

  return Option.some({ from: file, to });
});

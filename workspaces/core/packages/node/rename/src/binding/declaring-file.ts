import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Array, Effect, Option } from 'effect';
import { join, relative } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { DeclarationMissing, DeclarationShared } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import type { BindingRename } from '../types.ts';
import { declarationAts } from './declaration-ats.ts';
import type { DeclaringFile } from './types.ts';

/** The binding to find, and the absolute path of every TypeScript file of the workspace. */
type DeclaringFileInput = { readonly binding: BindingRename; readonly files: ReadonlyArray<string> };

/** A TypeScript file of the workspace, by its absolute path, and the binding's name. */
type FileDeclarationInput = { readonly path: string; readonly name: string };

/**
 * The one TypeScript file of the workspace that declares the binding at its top level, with its text and the lines that
 * declare it. Where two files declare the name, the binding names its file.
 */
export const declaringFile = Effect.fn('declaringFile')(function* ({
  binding,
  files,
}: DeclaringFileInput): Effect.fn.Return<DeclaringFile, FileFailed | DeclarationMissing | DeclarationShared> {
  /** The workspace's TypeScript file the binding names, relative to the workspace. */
  const namedFiles: (file: string) => ReadonlyArray<string> = (file) => {
    const named = join(WORKSPACE_FOLDER, file);

    return files.filter((path) => path === named);
  };

  const candidates = Option.match(binding.file, { onNone: () => files, onSome: namedFiles });

  const found = yield* Effect.forEach(candidates, (path) => fileDeclaration({ path, name: binding.from }), {
    concurrency: 1,
  });

  const declaring = Array.getSomes(found);

  if (declaring.length > 1) {
    const paths = declaring.map(({ path }) => relative(WORKSPACE_FOLDER, path));

    return yield* new DeclarationShared({ name: binding.from, paths });
  }

  const only = Array.head(declaring);

  if (Option.isNone(only)) {
    return yield* new DeclarationMissing({ name: binding.from });
  }

  return only.value;
});

/** The file's declaration of the binding, with its text and declaring lines; none when it declares no such name. */
const fileDeclaration = Effect.fn('fileDeclaration')(function* ({
  path,
  name,
}: FileDeclarationInput): Effect.fn.Return<Option.Option<DeclaringFile>, FileFailed> {
  const text = yield* readText({ path });
  const ats = declarationAts({ name, text });

  if (ats.length === 0) {
    return Option.none();
  }

  return Option.some({ path, text, ats });
});

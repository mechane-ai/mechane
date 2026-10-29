import { FACTORY_FOLDER, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import { Effect } from 'effect';
import { extname } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { factoryFiles } from './factory-files.ts';

/** The absolute path of every TypeScript file of the workspace, which holds each identifier's declaration and uses. */
export const workspaceSources = Effect.fn('workspaceSources')(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  FileFailed
> {
  const files = yield* factoryFiles({ folder: FACTORY_FOLDER });

  /** Whether the file is a TypeScript file of the workspace. */
  const isSource: (path: string) => boolean = (path) =>
    path.startsWith(WORKSPACE_FOLDER) && extname(path) === TYPESCRIPT_EXTENSION;

  return files.filter(isSource);
});

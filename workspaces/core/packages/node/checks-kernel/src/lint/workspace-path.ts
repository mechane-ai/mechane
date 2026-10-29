import { relative, resolve } from 'node:path';
import { WORKSPACE_FOLDER } from '../constants.ts';

type WorkspacePathInput = { readonly file: string };

/** A linter's path for a file, relative to the folder it ran in or absolute, as the workspace names it. */
export function workspacePath({ file }: WorkspacePathInput): string {
  return relative(WORKSPACE_FOLDER, resolve(file));
}

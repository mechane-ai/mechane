import { CHILD_TIMEOUT, InputUnreadable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { finishedProcess, sha256Hex } from '@mechane/program';
import { Effect } from 'effect';
import { join } from 'node:path';
import type { BundleEntry, RoleHash } from './types.ts';

type BundleHashInput = { readonly bundle: BundleEntry; readonly inherited: Readonly<Record<string, string>> };

/**
 * Builds one minified bundle with Bun and hashes it; minifying drops comments and local names, so a type change, a
 * binding rename or a move leaves the bytes equal.
 */
export const bundleHash = Effect.fn('bundleHash')(function* ({
  bundle,
  inherited,
}: BundleHashInput): Effect.fn.Return<RoleHash, InputUnreadable> {
  const { role, entry, target, externals } = bundle;

  /** Bun's flag that leaves one module out of the bundle. */
  const externalFlag: (name: string) => string = (name) => `--external=${name}`;

  const { stdout } = yield* finishedProcess({
    command: 'bun',
    args: ['build', join(WORKSPACE_FOLDER, entry), `--target=${target}`, '--minify', ...externals.map(externalFlag)],
    environment: inherited,
    timeout: CHILD_TIMEOUT,
  }).pipe(Effect.mapError(({ reason }) => new InputUnreadable({ path: entry, reason })));

  return { role, hash: sha256Hex({ contents: stdout }) };
});

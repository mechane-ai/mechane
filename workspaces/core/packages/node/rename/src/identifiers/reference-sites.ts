import { Effect } from 'effect';
import type { FileFailed } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import type { Site } from '../types.ts';
import { occurrences } from './occurrences.ts';

/** The workspace's TypeScript files, and the name a reference spells. */
type ReferenceSitesInput = { readonly files: ReadonlyArray<string>; readonly name: string };

/** One TypeScript file, by its absolute path, and the name a reference spells. */
type FileSitesInput = { readonly path: string; readonly name: string };

/** Every occurrence of the name as a whole word in the workspace's TypeScript files, where a reference may start. */
export const referenceSites = Effect.fn('referenceSites')(function* ({
  files,
  name,
}: ReferenceSitesInput): Effect.fn.Return<ReadonlyArray<Site>, FileFailed> {
  const groups = yield* Effect.forEach(files, (path) => fileSites({ path, name }), { concurrency: 1 });

  return groups.flat();
});

/** Every occurrence of the name as a whole word in one file. */
const fileSites = Effect.fn('fileSites')(function* ({
  path,
  name,
}: FileSitesInput): Effect.fn.Return<ReadonlyArray<Site>, FileFailed> {
  const text = yield* readText({ path });

  return occurrences({ text, name }).map((site) => ({ path, ...site }));
});

import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import type { ParsedSource } from '@mechane/modules';
import { Effect } from 'effect';
import type { InputUnreadable } from '../errors.ts';
import { listFiles } from '../list-files.ts';
import type { Member } from '../types.ts';
import { parseSource } from './parse-source.ts';

/** The workspace's members, whose source roots hold the files to parse. */
type ParsedSourcesInput = { readonly members: ReadonlyArray<Member> };

/** Every TypeScript file of the members' source roots, read and parsed once for every owned check that reads it. */
export const parsedSources = Effect.fn('parsedSources')(function* ({
  members,
}: ParsedSourcesInput): Effect.fn.Return<ReadonlyArray<ParsedSource>, InputUnreadable> {
  const roots = members.flatMap(({ sourceRoots }) => sourceRoots);

  const queries = roots.flatMap((folder) => [
    { folder, extension: TYPESCRIPT_EXTENSION },
    { folder, extension: '.tsx' },
  ]);

  const paths = yield* Effect.forEach(queries, (query) => listFiles(query), { concurrency: 'unbounded' });

  return yield* Effect.forEach(paths.flat(), (path) => parseSource({ path }), { concurrency: 1 });
});

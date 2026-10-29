import type { InputUnreadable, Site } from '@mechane/checks-kernel';
import { listFiles, readText } from '@mechane/checks-kernel';
import { WIRE_LOCK } from '@mechane/program';
import { Effect, Record } from 'effect';
import { contractSites } from './contract-sites.ts';
import { historySites } from './history-sites.ts';
import { phraseSites } from './phrase-sites.ts';
import { proseRuns } from './prose-runs.ts';
import type { BannedPhrase } from './types.ts';

/** The banned phrases, and the history words no wire name holds. */
type DocumentSitesInput = { readonly phrases: ReadonlyArray<BannedPhrase>; readonly historyWords: ReadonlySet<string> };

/** The command reference, whose exit statuses the output-channels contract states and whose words the CLI publishes. */
const COMMAND_REFERENCE = 'packages/node/cli/reference.json';

/** The contract folders, relative to the workspace: the product's and the factory's. */
const CONTRACT_FOLDERS = { product: '.contracts', factory: '../../.contracts' } as const;

/** The file name of a contract in a contract folder. */
const CONTRACT_FILE = 'CONTRACT.md';

/**
 * The banned phrases of Mechane's own words outside its code: the command reference, each contract's local adaptations,
 * and the whole of a contract without any, which is Mechane's own. The wire lock's names also hold no history word.
 */
export const documentSites = Effect.fn('documentSites')(function* ({
  phrases,
  historyWords,
}: DocumentSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const folders = yield* Effect.forEach(
    Record.values(CONTRACT_FOLDERS),
    (folder) => listFiles({ folder, extension: CONTRACT_FILE }),
    { concurrency: 'unbounded' },
  );

  const contracts = yield* Effect.forEach(folders.flat(), (path) => contractSites({ path, phrases }), {
    concurrency: 'unbounded',
  });

  const reference = yield* readText({ path: COMMAND_REFERENCE });
  const wire = yield* readText({ path: WIRE_LOCK });
  const runs = proseRuns({ text: reference, offset: 0 });
  const wireRuns = proseRuns({ text: wire, offset: 0 });

  return [
    ...phraseSites({ file: COMMAND_REFERENCE, text: reference, runs, phrases }),
    ...phraseSites({ file: WIRE_LOCK, text: wire, runs: wireRuns, phrases }),
    ...historySites({ file: WIRE_LOCK, text: wire, runs: wireRuns, historyWords }),
    ...contracts.flat(),
  ];
});

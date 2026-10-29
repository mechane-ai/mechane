import { generatedFiles } from '@mechane/rules';
import type { GeneratedFile } from '@mechane/rules';
import { Effect } from 'effect';
import { GenerateCommand } from './constants.ts';
import type { GenerateFailed } from './errors.ts';
import { formattedFile } from './files/formatted-file.ts';
import { readContracts } from './files/read-contracts.ts';
import { readExitStatuses } from './files/read-exit-statuses.ts';
import { readMembers } from './files/read-members.ts';
import { readWordLists } from './files/read-word-lists.ts';
import { staleFiles } from './files/stale-files.ts';
import { writeFiles } from './files/write-files.ts';
import { staleLines } from './stale-lines.ts';
import type { GeneratorRun, RegistryFinding } from './types.ts';
import { registryFindings } from './validate/registry-findings.ts';

type RunGeneratorInput = { readonly command: GeneratorRun['command'] };

/** The generated files, the paths of those that differ and of each stray, and the registry's findings as lines. */
type WriteStaleInput = {
  readonly files: ReadonlyArray<GeneratedFile>;
  readonly changed: ReadonlyArray<string>;
  readonly strays: ReadonlyArray<string>;
  readonly lines: ReadonlyArray<string>;
};

/**
 * Renders every file the registry generates, formats it as the formatter would, and checks the registry. `write` writes
 * each file that differs and deletes each stray, and `check` reports both. Both report each finding of the registry,
 * which `rules:check` fails on.
 */
export const runGenerator = Effect.fn('runGenerator')(function* ({
  command,
}: RunGeneratorInput): Effect.fn.Return<ReadonlyArray<string>, GenerateFailed> {
  const wordLists = yield* readWordLists();
  const contracts = yield* readContracts();

  const { configurations, verbatim } = generatedFiles({
    contracts,
    wordLists,
    exitStatuses: yield* readExitStatuses(),
    members: yield* readMembers(),
  });

  const formatted = yield* Effect.forEach(configurations, (file) => formattedFile({ file }), { concurrency: 1 });
  const files = [...formatted, ...verbatim];
  const { changed, strays } = yield* staleFiles({ files });
  const findings = yield* registryFindings({ wordLists, contracts });
  const findingLine: (finding: RegistryFinding) => string = ({ path, message }) => `${path}: ${message}`;
  const lines = findings.map(findingLine);

  switch (command) {
    case GenerateCommand.Write:
      return yield* writeStale({ files, changed, strays, lines });
    case GenerateCommand.Check:
      return staleLines({ changed, strays, lines });
  }
});

/** Writes each generated file that differs and deletes each stray, then answers the registry's findings. */
const writeStale = Effect.fn('writeStale')(function* ({
  files,
  changed,
  strays,
  lines,
}: WriteStaleInput): Effect.fn.Return<ReadonlyArray<string>, GenerateFailed> {
  yield* writeFiles({ files: files.filter(({ path }) => changed.includes(path)), strays });

  return lines;
});

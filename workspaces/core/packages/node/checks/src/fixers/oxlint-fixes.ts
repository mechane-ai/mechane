import { FileUnwritable, OXLINT, removePath, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import type { OxlintSettings } from '@mechane/rules';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finishedTool } from './finished-tool.ts';

/**
 * The configuration a fix writes beside .oxlintrc.json for one oxlint run, whose override paths resolve from its own
 * folder as that file's do, and removes once the run ends.
 */
const FIX_CONFIGURATION = join(WORKSPACE_FOLDER, '.oxlintrc.fix.json');

/**
 * The settings oxlint fixes with, the files and folders it reads, the globs of the files it leaves, and the variables
 * it inherits.
 */
type OxlintFixesInput = {
  readonly configuration: OxlintSettings;
  readonly targets: ReadonlyArray<string>;
  readonly excluded: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Applies oxlint's safe fixes over `targets` but the files an `excluded` glob matches, in one run, with `configuration`
 * written beside .oxlintrc.json for the run.
 */
export const oxlintFixes = Effect.fn('oxlintFixes')(function* ({
  configuration,
  targets,
  excluded,
  inherited,
}: OxlintFixesInput): Effect.fn.Return<void, ChecksFailure, Scope.Scope> {
  const text = JSON.stringify(configuration);

  yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => writeFile(FIX_CONFIGURATION, text),
      catch: (cause) => new FileUnwritable({ path: FIX_CONFIGURATION, reason: String(cause) }),
    }),
    () => removePath({ path: FIX_CONFIGURATION }),
  );

  /** oxlint's flag that leaves the files a glob matches. */
  const excludedFlag: (glob: string) => string = (glob) => `--ignore-pattern=${glob}`;

  yield* finishedTool({
    command: OXLINT,
    args: [
      '-c',
      FIX_CONFIGURATION,
      '--fix',
      '--threads=2',
      '--no-error-on-unmatched-pattern',
      ...excluded.map(excludedFlag),
      ...targets,
    ],
    inherited,
  });
}, Effect.scoped);

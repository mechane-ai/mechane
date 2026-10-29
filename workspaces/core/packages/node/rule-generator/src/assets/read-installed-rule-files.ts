import { RuleTool } from '@mechane/rule-shapes';
import type { ContractLock } from '@mechane/rule-shapes';
import type { AssetEntry } from '@mechane/rules';
import { Array, Effect, Record, Schema } from 'effect';
import { posix } from 'node:path';
import type { GenerateFailed } from '../errors.ts';
import { readYaml } from '../files/read-yaml.ts';
import { AstGrepRuleId } from '../schemas.ts';
import type { RuleFile } from '../types.ts';
import { installedFiles } from './installed-files.ts';

/** The language of the files Mechane lints, whose rules among an installed folder's the registry reads. */
const LINTED_LANGUAGE = 'TypeScript';

/** The files a TypeScript rule without file globs scans: every file of its language, as ast-grep reads one. */
const TYPESCRIPT_FILES = '**/*.{ts,mts,cts}';

/** The end of an ast-grep rule file's name. */
const RULE_FILE_END = '.yml';

/**
 * The fields of a rule file an installed contract ships that the registry reads: its id, language, severity and
 * message, the files it skips and its fix. It scans every file of its language.
 */
const InstalledRuleFields = Schema.Struct({
  id: AstGrepRuleId,
  language: Schema.String,
  severity: Schema.String,
  message: Schema.String,
  /** The files it skips; absent when it skips none of the files of its language. */
  ignores: Schema.OptionFromOptionalKey(Schema.Array(Schema.String)),
  /** The rewrite of each match; absent when the fix needs a person. */
  fix: Schema.OptionFromOptionalKey(Schema.String),
});

/** The rules that load an installed file in place, and the lock that lists each installed file. */
type ReadInstalledRuleFilesInput = { readonly entries: ReadonlyArray<AssetEntry>; readonly lock: ContractLock };

/** An installed rule file's path, relative to the workspace. */
type ReadInstalledRuleFileInput = { readonly path: string };

/**
 * Each TypeScript rule file of the installed rule folders a rule loads, sorted by path. Each scans every TypeScript
 * file but those its `ignores` skip.
 */
export const readInstalledRuleFiles = Effect.fn('readInstalledRuleFiles')(function* ({
  entries,
  lock,
}: ReadInstalledRuleFilesInput): Effect.fn.Return<ReadonlyArray<RuleFile>, GenerateFailed> {
  const folderFiles: (entry: AssetEntry) => ReadonlyArray<string> = ({ contract, rule, asset }) => {
    if (rule.tool !== RuleTool.AstGrep) {
      return [];
    }

    const folder = posix.dirname(contract.path);
    const installed = installedFiles({ lock, contract });
    const listed = Record.keys(installed);

    const isFolderRule: (file: string) => boolean = (file) =>
      posix.dirname(file) === asset.path && file.endsWith(RULE_FILE_END);

    return listed.filter(isFolderRule).map((file) => posix.join(folder, file));
  };

  const paths = entries.flatMap(folderFiles);
  const sorted = Array.dedupe(paths).toSorted();
  const files = yield* Effect.forEach(sorted, (path) => readInstalledRuleFile({ path }), { concurrency: 1 });

  return files.flat();
});

/** One installed rule file, when it is a TypeScript rule: its id, message and the files it skips. */
const readInstalledRuleFile = Effect.fn('readInstalledRuleFile')(function* ({
  path,
}: ReadInstalledRuleFileInput): Effect.fn.Return<ReadonlyArray<RuleFile>, GenerateFailed> {
  const { language, ...fields } = yield* readYaml({ path, schema: InstalledRuleFields });

  if (language !== LINTED_LANGUAGE) {
    return [];
  }

  return [{ path, ...fields, files: [TYPESCRIPT_FILES] }];
});

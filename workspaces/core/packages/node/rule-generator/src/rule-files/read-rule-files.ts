import { AST_GREP_RULES } from '@mechane/rules';
import { Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readYaml } from '../files/read-yaml.ts';
import { RuleFileFields } from '../schemas.ts';
import type { RuleFile } from '../types.ts';

/** A rule file's path, relative to the workspace. */
type ReadRuleFileInput = { readonly path: string };

/** Every rule file of the ast-grep rule folder, sorted by path. */
export const readRuleFiles = Effect.fn('readRuleFiles')(function* (): Effect.fn.Return<
  ReadonlyArray<RuleFile>,
  GenerateFailed
> {
  const folder = join(WORKSPACE_FOLDER, AST_GREP_RULES);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(folder),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: AST_GREP_RULES, reason: String(cause) }),
  });

  const paths = entries
    .filter((entry) => entry.endsWith('.yml'))
    .toSorted()
    .map((entry) => join(AST_GREP_RULES, entry));

  return yield* Effect.forEach(paths, (path) => readRuleFile({ path }), { concurrency: 1 });
});

/** One rule file's id, message and file patterns. */
const readRuleFile = Effect.fn('readRuleFile')(function* ({
  path,
}: ReadRuleFileInput): Effect.fn.Return<RuleFile, GenerateFailed> {
  const fields = yield* readYaml({ path, schema: RuleFileFields });

  return { path, ...fields };
});

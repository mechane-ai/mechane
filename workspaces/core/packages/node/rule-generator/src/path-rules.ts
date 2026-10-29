import { Effect } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GenerateStatus, GenerateStep, WORKSPACE_FOLDER } from './constants.ts';
import { GenerateFailed } from './errors.ts';
import { rulesForPath } from './explain/rules-for-path.ts';
import { scannedRuleFiles } from './rule-files/scanned-rule-files.ts';
import type { Outcome } from './types.ts';

/** A path relative to the workspace. */
type PathRulesInput = { readonly path: string };

/** Each rule that applies to a file of the workspace; a path that names no file fails. */
export const pathRules = Effect.fn('pathRules')(function* ({
  path,
}: PathRulesInput): Effect.fn.Return<Outcome, GenerateFailed> {
  if (!existsSync(join(WORKSPACE_FOLDER, path))) {
    return yield* new GenerateFailed({
      step: GenerateStep.Read,
      path,
      reason: 'name a file of the workspace, relative to it, such as `packages/node/checks/src/main.ts`',
    });
  }

  const ruleFiles = yield* scannedRuleFiles();

  return { status: GenerateStatus.Current, results: rulesForPath({ path, ruleFiles }) };
});

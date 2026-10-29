import { assetEntries } from '@mechane/rules';
import { Effect } from 'effect';
import { readInstalledRuleFiles } from '../assets/read-installed-rule-files.ts';
import { readLock } from '../assets/read-lock.ts';
import type { GenerateFailed } from '../errors.ts';
import { readContracts } from '../files/read-contracts.ts';
import type { RuleFile } from '../types.ts';
import { readRuleFiles } from './read-rule-files.ts';

/** Each rule file of those `sgconfig.yml` loads that the registry reads: the authored ones, then the installed ones. */
export const scannedRuleFiles = Effect.fn('scannedRuleFiles')(function* (): Effect.fn.Return<
  ReadonlyArray<RuleFile>,
  GenerateFailed
> {
  const authored = yield* readRuleFiles();
  const contracts = yield* readContracts();
  const entries = assetEntries({ contracts });
  const lock = yield* readLock();
  const installed = yield* readInstalledRuleFiles({ entries, lock });

  return [...authored, ...installed];
});

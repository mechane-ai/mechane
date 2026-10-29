import { RuleFix } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import { Option } from 'effect';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** The registry's ast-grep rules, and every ast-grep rule file. */
type FixFindingsInput = { readonly astGrep: ReadonlyArray<AstGrepRule>; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** Each ast-grep rule file whose `fix` its entry does not name, or whose entry names a fix its file lacks (TS-07). */
export function fixFindings({ astGrep, ruleFiles }: FixFindingsInput): ReadonlyArray<RegistryFinding> {
  const ruleFileFindings: (ruleFile: RuleFile) => ReadonlyArray<RegistryFinding> = ({ path, id, fix }) => {
    const isMismatched: (rule: AstGrepRule) => boolean = (rule) =>
      rule.name === id && Option.isSome(fix) !== (rule.fix === RuleFix.AstGrep);

    const fixFinding: (rule: AstGrepRule) => RegistryFinding = (rule) => {
      const message: string = (() => {
        if (rule.fix === RuleFix.AstGrep) {
          return `Set the fix of ${id} by hand, such as \`fix: RuleFix.Manual\`, since its rule file has no \`fix\` (TS-07)`;
        }

        return `Set the fix of ${id} to its rule file's, such as \`fix: RuleFix.AstGrep\`, since \`ast-grep scan -U\` applies it (TS-07)`;
      })();

      return { path, message };
    };

    return astGrep.filter(isMismatched).map(fixFinding);
  };

  return ruleFiles.flatMap(ruleFileFindings);
}

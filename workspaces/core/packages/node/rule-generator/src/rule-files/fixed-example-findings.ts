import { RuleFix } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding } from '../types.ts';

/** The registry's ast-grep rules. */
type FixedExampleFindingsInput = { readonly astGrep: ReadonlyArray<AstGrepRule> };

/**
 * Each ast-grep rule that does not show what its fix leaves of each violation, or that shows a fix it does not have
 * (TS-05).
 */
export function fixedExampleFindings({ astGrep }: FixedExampleFindingsInput): ReadonlyArray<RegistryFinding> {
  const lacksFixedExamples: (rule: AstGrepRule) => boolean = (rule) => {
    const expected: number = (() => {
      if (rule.fix === RuleFix.AstGrep) {
        return rule.violation.length;
      }

      return 0;
    })();

    return rule.fixed.length !== expected;
  };

  const fixedFinding: (rule: AstGrepRule) => RegistryFinding = ({ name }) => ({
    path: REGISTRY,
    message: `Give ${name} what its fix leaves of each violation, and nothing else, such as \`fixed: ['Effect.all(effects, { concurrency: 1 });']\` (TS-05)`,
  });

  return astGrep.filter(lacksFixedExamples).map(fixedFinding);
}

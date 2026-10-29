import { Effect } from 'effect';
import { GenerateStatus, GenerateStep } from './constants.ts';
import { GenerateFailed } from './errors.ts';
import { explainRule } from './explain/explain-rule.ts';
import { scannedRuleFiles } from './rule-files/scanned-rule-files.ts';
import type { Outcome } from './types.ts';

/** A rule's name or its rule of the standard, such as `boolean-names` or `EF-02`. */
type SubjectRulesInput = { readonly subject: string };

/** Each rule a name or a rule of the standard names; a subject that names none fails. */
export const subjectRules = Effect.fn('subjectRules')(function* ({
  subject,
}: SubjectRulesInput): Effect.fn.Return<Outcome, GenerateFailed> {
  const ruleFiles = yield* scannedRuleFiles();
  const results = explainRule({ subject, ruleFiles });

  if (results.length === 0) {
    return yield* new GenerateFailed({
      step: GenerateStep.Read,
      path: `the rule ${subject}`,
      reason: 'name a rule of the registry, by its name or its rule of the standard, such as `EF-02`',
    });
  }

  return { status: GenerateStatus.Current, results };
});

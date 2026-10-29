import { Severity } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import type { RegistryFinding, RuleFile } from '../types.ts';
import { fixFindings } from './fix-findings.ts';
import { fixedExampleFindings } from './fixed-example-findings.ts';
import { ignoreFindings } from './ignore-findings.ts';

/** The registry's ast-grep rules, and every ast-grep rule file. */
type RuleFileFindingsInput = {
  readonly astGrep: ReadonlyArray<AstGrepRule>;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
};

/**
 * Each ast-grep rule file whose severity is not an error (AS-04), or that scans a file of a role its entry exempts. A
 * rule file whose `fix` its entry does not name, or the reverse, and a rule file no entry registers, are ones too.
 */
export function ruleFileFindings({ astGrep, ruleFiles }: RuleFileFindingsInput): ReadonlyArray<RegistryFinding> {
  const registered: ReadonlySet<string> = new Set(astGrep.map(({ name }) => name));

  const severityFinding: (ruleFile: RuleFile) => RegistryFinding = ({ path, id }) => ({
    path,
    message: `Set the severity of ${id} to error, such as \`severity: error\` (AS-04)`,
  });

  const isUnregistered: (ruleFile: RuleFile) => boolean = ({ id }) => !registered.has(id);

  const unregisteredFinding: (ruleFile: RuleFile) => RegistryFinding = ({ path, id }) => ({
    path,
    message: `Register ${id} with examples beside its contract's rules, such as \`name: '${id}'\` (TS-05)`,
  });

  return [
    ...ruleFiles.filter(({ severity }) => severity !== Severity.Error).map(severityFinding),
    ...ignoreFindings({ astGrep, ruleFiles }),
    ...fixFindings({ astGrep, ruleFiles }),
    ...fixedExampleFindings({ astGrep }),
    ...ruleFiles.filter(isUnregistered).map(unregisteredFinding),
  ];
}

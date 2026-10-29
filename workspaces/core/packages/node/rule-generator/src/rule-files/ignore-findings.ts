import type { AstGrepRule } from '@mechane/rule-shapes';
import { FILE_ROLES } from '@mechane/rules';
import { Option } from 'effect';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** The registry's ast-grep rules, and every ast-grep rule file. */
type IgnoreFindingsInput = {
  readonly astGrep: ReadonlyArray<AstGrepRule>;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
};

/** The registry's ast-grep rules, and the id of the rule file whose entry's exempt roles to read. */
type ExemptGlobsInput = { readonly astGrep: ReadonlyArray<AstGrepRule>; readonly id: RuleFile['id'] };

/** Each glob of a role an ast-grep rule's entry exempts that its rule file's `ignores` lack (110). */
export function ignoreFindings({ astGrep, ruleFiles }: IgnoreFindingsInput): ReadonlyArray<RegistryFinding> {
  const ruleFileFindings: (ruleFile: RuleFile) => ReadonlyArray<RegistryFinding> = ({ path, id, ignores }) => {
    const ignored: ReadonlyArray<string> = Option.getOrElse(ignores, () => []);

    const ignoreFinding: (glob: string) => RegistryFinding = (glob) => ({
      path,
      message: `Ignore each file of the roles ${id} exempts, such as \`${glob}\` (110)`,
    });

    const isMissing: (glob: string) => boolean = (glob) => !ignored.includes(glob);

    return exemptGlobs({ astGrep, id }).filter(isMissing).map(ignoreFinding);
  };

  return ruleFiles.flatMap(ruleFileFindings);
}

/** The globs of every file role that a rule file's entry exempts. */
function exemptGlobs({ astGrep, id }: ExemptGlobsInput): ReadonlyArray<string> {
  const roleGlobs: (rule: AstGrepRule) => ReadonlyArray<string> = ({ exemptRoles }) =>
    exemptRoles.flatMap((role) => FILE_ROLES[role]);

  return astGrep.filter(({ name }) => name === id).flatMap(roleGlobs);
}

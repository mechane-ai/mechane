import { RuleTool } from '@mechane/rule-shapes';
import type { RegisteredRule, Rule } from '@mechane/rule-shapes';
import { CONTRACTS, FILE_ROLES, REGISTERED_RULES, ruleText } from '@mechane/rules';
import { Record } from 'effect';
import { matchesGlob } from 'node:path';
import type { RuleFile } from '../types.ts';
import { LINTED_FILE } from './constants.ts';
import { isCruised } from './is-cruised.ts';
import { isScanned } from './is-scanned.ts';

/** A path relative to the workspace, and every ast-grep rule file, whose globs say which files it scans. */
type PathRulesInput = { readonly path: string; readonly ruleFiles: ReadonlyArray<RuleFile> };

/** A rule, the path, the ast-grep rule files, the roles whose globs match the path, and whether oxlint reads it. */
type AppliesInput = {
  readonly rule: Rule;
  readonly path: string;
  readonly ruleFiles: ReadonlyArray<RuleFile>;
  readonly roles: ReadonlyArray<string>;
  readonly isLinted: boolean;
};

/**
 * Each rule of the registry that applies to `path`, as its contract's block states it: every owned rule and each
 * ast-grep rule that scans it. A script adds each oxlint rule its roles do not exempt, each cruiser rule whose path it
 * matches and each family of the manifest. A TypeScript file adds the compiler's options and the normalizers.
 */
export function rulesForPath({ path, ruleFiles }: PathRulesInput): ReadonlyArray<string> {
  const isPathRole: (role: readonly [string, ReadonlyArray<string>]) => boolean = ([, patterns]) =>
    patterns.some((pattern) => matchesGlob(path, pattern));

  const roles = Record.toEntries(FILE_ROLES)
    .filter(isPathRole)
    .map(([role]) => role);

  const { ignorePatterns } = CONTRACTS['code-lint-suppressions'].values.oxlint;
  const isLinted = LINTED_FILE.test(path) && !ignorePatterns.some((pattern) => matchesGlob(path, pattern));
  const ruleLine: (registered: RegisteredRule) => string = ({ contract, rule }) => `${contract}: ${ruleText({ rule })}`;

  return REGISTERED_RULES.filter(({ rule }) => applies({ rule, path, ruleFiles, roles, isLinted })).map(ruleLine);
}

/** Whether a rule reaches the path: by the files its tool reads, less the roles and files it exempts. */
function applies({ rule, path, ruleFiles, roles, isLinted }: AppliesInput): boolean {
  switch (rule.tool) {
    case RuleTool.Oxlint:
    case RuleTool.Restricted:
      return isLinted && !rule.exemptRoles.some((role) => roles.includes(role));
    case RuleTool.AstGrep:
      return ruleFiles
        .filter(({ id }) => id === rule.name)
        .some(({ files, ignores }) => isScanned({ path, files, ignores }));
    case RuleTool.Compiler:
    case RuleTool.Normalizer:
      return path.endsWith('.ts');
    case RuleTool.Cruiser:
      return isCruised({ rule, path });
    case RuleTool.Manifest:
      return LINTED_FILE.test(path);
    case RuleTool.Owned:
      return true;
  }
}

import { RuleTool } from '@mechane/rule-shapes';
import type { CruiserRule } from '@mechane/rule-shapes';
import { CONTRACTS, FILE_ROLES, REGISTERED_RULES } from '@mechane/rules';
import { Predicate, Record } from 'effect';
import { matchesGlob, posix } from 'node:path';
import { REGISTRY } from '../constants.ts';
import type { RegistryFinding, RuleFile } from '../types.ts';

/** Every file below a folder jscpd scans. */
const SCANNED_FILES = '**';

/** Every ast-grep rule file, and every file and folder of the workspace. */
type PatternFindingsInput = { readonly ruleFiles: ReadonlyArray<RuleFile>; readonly files: ReadonlyArray<string> };

/** A file of the workspace, and a pattern that may match it. */
type MatchInput = { readonly file: string; readonly pattern: string };

/** How a pattern reads: a glob, or a dependency-cruiser regular expression. */
const PatternKind = { Glob: 'glob', Expression: 'expression' } as const;

type PatternKind = (typeof PatternKind)[keyof typeof PatternKind];

/** Whether a pattern of each kind matches a file. */
const MATCHERS: Readonly<Record<PatternKind, (input: MatchInput) => boolean>> = {
  [PatternKind.Glob]: ({ file, pattern }) => matchesGlob(file, pattern),
  [PatternKind.Expression]: ({ file, pattern }) => new RegExp(pattern).test(file),
};

/** The file that declares some patterns, the owner they belong to, and the patterns. */
type OwnedPatterns = { readonly path: string; readonly owner: string; readonly patterns: ReadonlyArray<string> };

/** A pattern's owner, the patterns and their kind, and the files they must match. */
type UnmatchedInput = {
  readonly path: string;
  readonly owner: string;
  readonly patterns: ReadonlyArray<string>;
  readonly kind: PatternKind;
  readonly files: ReadonlyArray<string>;
};

/**
 * Each path pattern that matches no file of the workspace, so its rule or template could never fail (TS-09). The
 * patterns are each file role's glob, the unexercised globs, each ast-grep rule's `files` glob, the `path` a cruiser
 * rule starts from, and the folders jscpd scans. A cruiser rule's `to` names installed modules, which only a cruise
 * sees, and a pattern a tool skips leaves no rule unable to fail.
 */
export function patternFindings({ ruleFiles, files }: PatternFindingsInput): ReadonlyArray<RegistryFinding> {
  const cruiser = REGISTERED_RULES.map(({ rule }) => rule).filter((rule) => rule.tool === RuleTool.Cruiser);

  const roleGlobs: (role: readonly [string, ReadonlyArray<string>]) => OwnedPatterns = ([role, patterns]) => ({
    path: REGISTRY,
    owner: `the ${role} role`,
    patterns,
  });

  const scanned = CONTRACTS['code-duplicated-blocks'].values.jscpd.path.map((folder) =>
    posix.join(folder, SCANNED_FILES),
  );

  const globs: ReadonlyArray<OwnedPatterns> = [
    ...Record.toEntries(FILE_ROLES).map(roleGlobs),
    { path: REGISTRY, owner: 'the unexercised code', patterns: CONTRACTS['rule-registry'].values.unexercised },
    { path: REGISTRY, owner: 'jscpd', patterns: scanned },
    ...ruleFiles.map(({ path, id, files: patterns }) => ({ path, owner: id, patterns })),
  ];

  const unmatchedGlobs: (owned: OwnedPatterns) => ReadonlyArray<RegistryFinding> = (owned) =>
    unmatched({ ...owned, kind: PatternKind.Glob, files });

  const unmatchedStarts: (rule: CruiserRule) => ReadonlyArray<RegistryFinding> = ({ name, from }) =>
    unmatched({
      path: REGISTRY,
      owner: name,
      patterns: [from['path']].filter(Predicate.isString),
      kind: PatternKind.Expression,
      files,
    });

  return [...globs.flatMap(unmatchedGlobs), ...cruiser.flatMap(unmatchedStarts)];
}

/** Each of an owner's patterns that matches none of the files, as a finding at the owner's file. */
function unmatched({ path, owner, patterns, kind, files }: UnmatchedInput): ReadonlyArray<RegistryFinding> {
  const matchesNone: (pattern: string) => boolean = (pattern) =>
    !files.some((file) => MATCHERS[kind]({ file, pattern }));

  const unmatchedFinding: (pattern: string) => RegistryFinding = (pattern) => ({
    path,
    message: `Fix the pattern ${pattern} of ${owner} so it matches a file, such as \`packages/*/src/**\` (TS-09)`,
  });

  return patterns.filter(matchesNone).map(unmatchedFinding);
}

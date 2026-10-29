import { CHECKS_PROGRAM, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { ChecksFailure, Finding } from '@mechane/checks-kernel';
import { normalize } from '@mechane/normalizers';
import { writeDiagnostic } from '@mechane/program';
import { Normalizer, RuleTool } from '@mechane/rule-shapes';
import { gatedGlobs, REGISTERED_RULES } from '@mechane/rules';
import { Array, Effect, Schema } from 'effect';
import { matchesGlob, relative } from 'node:path';
import { astGrepFixes } from './ast-grep-fixes.ts';
import { oxlintFixes } from './oxlint-fixes.ts';
import { sweepConfiguration } from './sweep-configuration.ts';

/** The rule a sweep fixes, the paths it sweeps, every file when they are none, and the variables linters inherit. */
type SweepRuleInput = {
  readonly rule: string;
  readonly paths: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/** The absolute paths a sweep names, and the globs of the files it leaves, relative to the workspace. */
type KeptPathsInput = { readonly paths: ReadonlyArray<string>; readonly excluded: ReadonlyArray<string> };

/**
 * Applies one rule's autofix over `paths`, or over the workspace when they are none, so each rule's sweep lands in its
 * own commit. The rule is a normalizer's name, an ast-grep rule's id or an oxlint rule's name. A rule whose fix changes
 * field names or restructures leaves the code the smoke cannot reach as it is, and says so (TS-07).
 */
export const sweepRule = Effect.fn('sweepRule')(function* ({
  rule,
  paths,
  inherited,
}: SweepRuleInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const excluded = gatedGlobs({ rule });

  if (excluded.length > 0) {
    const line = `the sweep of ${rule} leaves ${excluded.join(', ')}, which only the live release verification reaches (TS-07)`;

    writeDiagnostic({ program: CHECKS_PROGRAM, line });
  }

  if (Schema.is(Schema.Enum(Normalizer))(rule)) {
    yield* normalize({ normalizer: rule, paths });

    return [];
  }

  const kept = keptPaths({ paths, excluded });

  if (kept.length < paths.length && kept.length === 0) {
    return [];
  }

  const targets = Array.match(kept, { onEmpty: () => [WORKSPACE_FOLDER], onNonEmpty: (named) => named });

  const isAstGrep = REGISTERED_RULES.some(
    ({ rule: registered }) => registered.tool === RuleTool.AstGrep && registered.name === rule,
  );

  if (isAstGrep) {
    yield* astGrepFixes({ rules: [rule], targets, excluded, inherited });

    return [];
  }

  yield* oxlintFixes({ configuration: yield* sweepConfiguration({ rule }), targets, excluded, inherited });

  return [];
});

/** The paths a sweep names that no excluded glob matches; ast-grep scans a named path whatever its globs say. */
function keptPaths({ paths, excluded }: KeptPathsInput): ReadonlyArray<string> {
  /** Whether no excluded glob matches the path, relative to the workspace. */
  const isKept: (path: string) => boolean = (path) => {
    const relativePath = relative(WORKSPACE_FOLDER, path);

    return !excluded.some((glob) => matchesGlob(relativePath, glob));
  };

  return paths.filter(isKept);
}

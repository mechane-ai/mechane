import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { ChecksFailure, Finding } from '@mechane/checks-kernel';
import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Effect, Option } from 'effect';
import { astGrepFixes } from './ast-grep-fixes.ts';
import { enforcedConfiguration } from './enforced-configuration.ts';
import { oxlintFixes } from './oxlint-fixes.ts';
import { sweepRule } from './sweep-rule.ts';

/** The rule a fix names, the paths it sweeps that rule over, and the variables linters inherit. */
type ApplyFixesInput = {
  /** Absent for a fix of every enforced rule. */
  readonly rule: Option.Option<string>;
  readonly paths: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * The fix command, which `mise run fix` runs after the normalizers. It sweeps a named rule's autofix whatever its
 * status, or applies oxlint's safe fixes and the ast-grep fixes of every enforced rule. A ratchet's or a proposed
 * rule's autofix waits for its sweep, so a fix never rewrites a site a baseline holds.
 */
export const applyFixes = Effect.fn('applyFixes')(function* ({
  rule,
  paths,
  inherited,
}: ApplyFixesInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  if (Option.isSome(rule)) {
    return yield* sweepRule({ rule: rule.value, paths, inherited });
  }

  const astGrep = REGISTERED_RULES.map(({ rule: registered }) => registered)
    .filter((registered) => registered.tool === RuleTool.AstGrep)
    .filter(({ status }) => status === RuleStatus.Enforced)
    .map(({ name }) => name);

  const targets = [WORKSPACE_FOLDER];

  yield* oxlintFixes({ configuration: enforcedConfiguration(), targets, excluded: [], inherited });
  yield* astGrepFixes({ rules: astGrep, targets, excluded: [], inherited });

  return [];
});

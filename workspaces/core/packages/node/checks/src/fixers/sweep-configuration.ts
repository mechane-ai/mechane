import { InputUnreadable } from '@mechane/checks-kernel';
import { RuleTool, Severity } from '@mechane/rule-shapes';
import { oxlintSettings } from '@mechane/rules';
import type { OxlintSettings } from '@mechane/rules';
import { Array, Effect, Record } from 'effect';
import { NO_OPT_OUTS } from '../constants.ts';
import { measuredRules } from '../measure/measured-rules.ts';

type SweepConfigurationInput = { readonly rule: string };

/**
 * oxlint's settings that run only `rule`, so a sweep fixes that rule alone. The rule takes the value the registry gives
 * it, the standard's where a proposed entry names it, and is off in each file role it exempts.
 */
export const sweepConfiguration = Effect.fn('sweepConfiguration')(function* ({
  rule,
}: SweepConfigurationInput): Effect.fn.Return<OxlintSettings, InputUnreadable> {
  const entries = measuredRules()
    .map(({ rule: registered }) => registered)
    .filter((registered) => registered.tool === RuleTool.Oxlint)
    .filter(({ name }) => name === rule);

  if (!Array.isReadonlyArrayNonEmpty(entries)) {
    return yield* new InputUnreadable({
      path: `the rule ${rule}`,
      reason: 'name a normalizer, an ast-grep rule, or an oxlint rule of the registry, such as `typescript/array-type`',
    });
  }

  const settings = oxlintSettings({ rules: entries, optOuts: NO_OPT_OUTS });

  return { ...settings, categories: Record.map(settings.categories, () => Severity.Off) };
});

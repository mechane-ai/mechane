import { AST_GREP_DEFAULTS, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/** Value selection retains its declared form; local callbacks use contextual typing. */
export const STYLE_FUNCTION_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'iife-form',
    standard: 'SC-01',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'const value = (() => { return 1; })();',
      'const delay: number = (async () => { return await wait(); })();',
      'const total: number = (() => { let sum = 0; for (const item of items) { sum += item; } return sum; })();',
      'const doubled: number = ((count) => { return count * 2; })(items);',
    ],
    allowed: [
      'const wait: Duration.Duration = (() => { if (isFollowing) { return WAIT_MAX; } return LISTING_WAIT; })();',
      'const references: ReadonlyArray<ObjectReference> = (() => { if (isTip) { return [object]; } const manifests = archiveManifests({ archive }); return manifests.flatMap(manifestReferences); })();',
    ],
  },
] as const;

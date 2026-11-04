import { ADOPTED, AST_GREP_DEFAULTS } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** Motion lifecycle and reduced-motion behavior are checked in the built browser. */
export const uiMotionLifecycle = {
  values: {},
  rules: [
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'ui-motion-properties',
      standard: '073',
      violation: [
        "const styles = { transitionProperty: 'all' };",
        "const styles = { transitionProperty: 'height, opacity' };",
        "const styles = { transition: 'opacity 140ms' };",
      ],
      allowed: [
        "const styles = { transition: { transitionProperty: 'opacity' } };",
        "const styles = { transitionProperty: 'opacity, transform' };",
        "const styles = { transitionProperty: 'transform' };",
      ],
    },
  ],
} as const satisfies ContractEnforcement;

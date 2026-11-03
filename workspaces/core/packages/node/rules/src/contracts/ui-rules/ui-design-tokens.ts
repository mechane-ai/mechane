import { ADOPTED, AST_GREP_DEFAULTS, InstalledAsset } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';

/** The same shipped pattern covers StyleX calls in ordinary TypeScript and JSX source. */
const VARIANT_STYLES = {
  ...AST_GREP_DEFAULTS,
  ...ADOPTED,
  asset: InstalledAsset.AstGrepRules,
  standard: '066',
  violation: [
    "stylex.props(styles.root, tone === 'positive' && styles.positive);",
    'stylex.props(styles.root, tone === Tone.Warning && styles.warning);',
  ],
  allowed: [
    'stylex.props(styles.root, toneStyles[tone]);',
    'stylex.props(styles.root, row.id === selectedId && styles.selected);',
    "stylex.props(styles.root, typeof size === 'number' && styles.fixed);",
  ],
} as const;

/** Contrast is a review criterion; variant selection is checked by the installed StyleX assets. */
export const uiDesignTokens = {
  values: { textContrast: 4.5, largeTextContrast: 3 },
  rules: [
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-typescript' },
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-tsx' },
  ],
} as const satisfies ContractEnforcement;

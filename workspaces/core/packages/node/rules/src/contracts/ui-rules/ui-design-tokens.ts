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
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'ui-visual-token-values',
      standard: '066',
      violation: [
        "const styles = { fontSize: '14px' };",
        "const styles = { backgroundColor: { ':hover': '#eeeeee' } };",
        "const styles = { transitionDuration: { default: '140ms' } };",
        'const styles = { fontSize: 14 };',
        'const styles = { fontWeight: 500 };',
        "const styles = { fontWeight: '500' };",
        'const styles = { gap: 12 };',
        'const styles = { outlineWidth: 2 };',
        "const styles = { boxShadow: '0 4px 16px #00000014' };",
        "const styles = { transitionTimingFunction: 'ease-out' };",
      ],
      allowed: [
        'const styles = { fontSize: typography.bodySize, backgroundColor: colors.surface };',
        'const styles = { fontWeight: typography.mediumWeight, gap: spacing.md };',
        "const styles = { transitionDuration: { default: motion.duration, [conditions.reducedMotion]: '0ms' } };",
        "const styles = { width: '14px', color: 'inherit' };",
        "const tokens = stylex.defineVars({ ink: '#0a0a0a', inputSize: '14px' });",
      ],
    },
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-typescript' },
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-tsx' },
  ],
} as const satisfies ContractEnforcement;

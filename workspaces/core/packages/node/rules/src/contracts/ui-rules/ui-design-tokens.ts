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

const VISUAL_VALUES = {
  ...AST_GREP_DEFAULTS,
  ...ADOPTED,
  standard: '066',
  violation: [
    "stylex.create({ root: { fontSize: '14px' } });",
    "stylex.create({ root: { backgroundColor: { ':hover': '#eeeeee' } } });",
    'stylex.create({ root: { fontWeight: 500, gap: 12 } });',
    "stylex.create({ root: { paddingInline: '12px' } });",
    'stylex.create({ root: { marginBlock: -4 } });',
    "stylex.create({ root: { borderRadius: { default: '4px' } } });",
    'stylex.create({ root: { padding: 0.5 } });',
    'stylex.create({ root: { padding: `12px` } });',
    "stylex.create({ root: { transitionDuration: '140ms', boxShadow: '0 4px 16px #00000014' } });",
  ],
  allowed: [
    'stylex.create({ root: { fontSize: typography.bodySize, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.sm } });',
    "stylex.create({ root: { margin: 'auto', gap: 0, width: '14px', height: 320, color: 'inherit' } });",
    "stylex.create({ root: { transitionDuration: { default: motion.duration, [conditions.reducedMotion]: '0ms' } } });",
    `stylex.create({ root: { paddingBlock: \`calc((\${controls.height} - 1px) / 2)\` } });`,
    "stylex.create({ hidden: { position: 'absolute', width: 1, height: 1, margin: -1, clipPath: 'inset(50%)' } });",
    "stylex.defineVars({ ink: '#0a0a0a', inputSize: '14px' });",
    'const measurements = { gap: 12, height: 320 };',
  ],
} as const;

const CONTROL_GEOMETRY = {
  ...AST_GREP_DEFAULTS,
  ...ADOPTED,
  standard: '066',
  violation: [
    'stylex.create({ button: { height: 32 } });',
    "stylex.create({ trigger: { minHeight: { default: '32px' } } });",
    'stylex.create({ choice: { height: { default: 20 } } });',
    'stylex.create({ text: { minHeight: 20 } });',
  ],
  allowed: [
    'stylex.create({ button: { minHeight: controls.height } });',
    "stylex.create({ choice: { height: controls.height, '::before': { height: 16 } } });",
    "stylex.create({ input: { height: '100%' }, textarea: { minHeight: 144 }, glyph: { height: 3 } });",
    "stylex.create({ button: { '::before': { height: 3 } } });",
  ],
} as const;

/** Contrast and measured rendering geometry still need visual review. */
export const uiDesignTokens = {
  values: { textContrast: 4.5, largeTextContrast: 3 },
  rules: [
    { ...VISUAL_VALUES, name: 'ui-visual-token-values' },
    { ...VISUAL_VALUES, name: 'ui-visual-token-values-typescript' },
    { ...CONTROL_GEOMETRY, name: 'ui-control-geometry' },
    { ...CONTROL_GEOMETRY, name: 'ui-control-geometry-typescript' },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'ui-control-style-overrides',
      standard: '066',
      violation: [
        "import { Button } from '@mechane-ai/elements'; const control = <Button style={{ height: 40 }} />;",
        "import { Input as Field } from '@mechane-ai/elements/forms'; const control = <Field className={styles.field} />;",
        "import { Select } from '@mechane-ai/elements/forms'; const control = <Select.Trigger {...stylex.props(styles.trigger)} />;",
      ],
      allowed: [
        "import { Button } from '@mechane-ai/elements'; const control = <Button xstyle={styles.placement} {...injectedProps} />;",
        "import { Select } from '@mechane-ai/elements/forms'; const control = <Select.Positioner style={{ left: position }} />;",
        'const control = <input style={{ width: measuredWidth }} />;',
        "import { Input } from './local-input'; const control = <Input className={styles.input} />;",
      ],
    },
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-typescript' },
    { ...VARIANT_STYLES, name: 'variant-style-comparisons-tsx' },
  ],
} as const satisfies ContractEnforcement;

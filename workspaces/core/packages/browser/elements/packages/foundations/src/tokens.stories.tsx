import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { colors, controls, radii, shadows, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  page: {
    display: 'grid',
    gap: spacing.xl,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: spacing.md },
  heading: { margin: 0, fontSize: typography.sectionSize, lineHeight: typography.sectionLineHeight },
  surface: {
    display: 'grid',
    gap: spacing.sm,
    minWidth: 160,
    padding: spacing.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  canvas: { backgroundColor: colors.canvas },
  positive: { color: colors.accent, backgroundColor: colors.accentSoft },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  negative: { color: colors.danger, backgroundColor: colors.dangerSoft },
  muted: { color: colors.muted },
  caption: { fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  mono: { fontFamily: typography.monoFamily },
  control: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingInline: controls.paddingInline,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
  },
  small: { minHeight: controls.smHeight },
  medium: { minHeight: controls.mdHeight },
  coarse: { minHeight: controls.coarseTarget },
  popup: { borderRadius: radii.md, boxShadow: shadows.popup },
});

const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    docs: {
      description: {
        component:
          'The catalog’s supported tag marks current public UI APIs with maintained behavior, types, examples and guidance for this package release. Application-only Screens are examples, not npm exports. Light and dark themes share token roles in ./tokens.stylex.ts; apply themeProps.light or themeProps.dark to the document root so portals inherit the choice. Applications own theme preference and persistence. Import directly from that definition export so both application and catalog compilers resolve StyleX variables. Colors name foreground and surface roles; typography, spacing, controls, radii, shadows, and motion hold shared choices. Prefer a component’s named variant before styling a wrapper. Shell geometry belongs to ui/layout, while chart geometry uses numbers in its caller’s unit. CSS variable references are not numeric scale inputs. Motion is decorative, brief, and removed for reduced-motion preferences; inspect it on the overlay examples.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Recommended: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <h2 {...stylex.props(styles.heading)}>Foregrounds and surfaces</h2>
      <div {...stylex.props(styles.row)}>
        <div {...stylex.props(styles.surface)}>
          Primary text<span {...stylex.props(styles.muted)}>Supporting text</span>
        </div>
        <div {...stylex.props(styles.surface, styles.canvas)}>
          Canvas<span {...stylex.props(styles.muted)}>Supporting text</span>
        </div>
        <div {...stylex.props(styles.surface, styles.positive)}>
          Positive<span>Completed</span>
        </div>
        <div {...stylex.props(styles.surface, styles.warning)}>
          Warning<span>Attention needed</span>
        </div>
        <div {...stylex.props(styles.surface, styles.negative)}>
          Danger<span>Action failed</span>
        </div>
      </div>
      <h2 {...stylex.props(styles.heading)}>Type roles</h2>
      <div>Body text for ordinary controls and content.</div>
      <div {...stylex.props(styles.caption, styles.muted)}>Caption text for supporting labels.</div>
      <div {...stylex.props(styles.mono)}>example-reference-2026</div>
    </div>
  ),
};

export const Geometry: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <h2 {...stylex.props(styles.heading)}>Control sizes</h2>
      <div {...stylex.props(styles.row)}>
        <div {...stylex.props(styles.control, styles.small)}>Compact</div>
        <div {...stylex.props(styles.control, styles.medium)}>Standard</div>
        <div {...stylex.props(styles.control, styles.coarse)}>Coarse pointer target</div>
      </div>
      <div {...stylex.props(styles.surface, styles.popup)}>Popup radius and shadow</div>
    </div>
  ),
};

import { colors, layers, spacing, typography } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';

export const overlayStyles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
    zIndex: layers.backdrop,
  },
  title: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.sectionSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: 600,
    color: colors.ink,
  },
  description: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.lg, minWidth: 0 },
});

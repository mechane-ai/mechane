import * as stylex from '@stylexjs/stylex';
import { colors, conditions, layers, motion, spacing, typography } from './tokens.stylex.ts';

export const overlayStyles = stylex.create({
  transition: {
    transitionProperty: 'opacity, transform',
    transitionDuration: { default: motion.duration, [conditions.reducedMotion]: '0ms' },
    transitionTimingFunction: motion.easing,
  },
  backdrop: {
    'position': 'fixed',
    'top': 0,
    'right': 0,
    'bottom': 0,
    'left': 0,
    'backgroundColor': colors.overlay,
    'zIndex': layers.backdrop,
    'opacity': 1,
    'transitionProperty': 'opacity',
    ':is([data-starting-style], [data-ending-style])': { opacity: 0 },
  },
  title: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.sectionSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: typography.strongWeight,
    color: colors.ink,
    overflowWrap: 'anywhere',
  },
  description: {
    margin: 0,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.lg, minWidth: 0 },
});

import * as stylex from '@stylexjs/stylex';
import { conditions } from './constants.stylex.ts';
import { colors, controls, pageGeometry, reportGeometry, spacing, typography } from './tokens.stylex.ts';

export const headerStyles = stylex.create({
  row: {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    minWidth: 0,
    minHeight: pageGeometry.toolbarHeight,
    paddingInline: pageGeometry.inset,
    paddingBlock: {
      default: `calc((${pageGeometry.toolbarHeight} - ${controls.height}) / 2)`,
      [conditions.coarsePointer]: `calc((${pageGeometry.toolbarHeight} - ${controls.coarseTarget}) / 2)`,
    },
  },
  reportRow: {
    minHeight: { default: reportGeometry.headerHeight, [conditions.coarsePointer]: pageGeometry.toolbarHeight },
    paddingBlock: {
      default: `calc((${reportGeometry.headerHeight} - ${controls.compactHeight}) / 2)`,
      [conditions.coarsePointer]: `calc((${pageGeometry.toolbarHeight} - ${controls.coarseTarget}) / 2)`,
    },
  },
  title: {
    flex: '1 1 auto',
    minWidth: 0,
    margin: 0,
    overflowWrap: 'anywhere',
    fontSize: typography.inputSize,
    fontWeight: typography.mediumWeight,
    lineHeight: typography.bodyLineHeight,
  },
  trailing: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginInlineStart: 'auto',
    minWidth: 0,
    maxWidth: '100%',
  },
  meta: {
    minWidth: 0,
    marginInlineStart: 'auto',
    overflowWrap: 'anywhere',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  actions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0, maxWidth: '100%' },
  blockEnd: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      insetBlockEnd: 0,
      height: 1,
      backgroundColor: colors.line,
      pointerEvents: 'none',
    },
  },
  blockStart: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      insetBlockStart: 0,
      height: 1,
      backgroundColor: colors.line,
      pointerEvents: 'none',
    },
  },
  inlineEnd: {
    '::after': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      insetInlineEnd: 0,
      width: 1,
      backgroundColor: colors.line,
      pointerEvents: 'none',
    },
  },
});

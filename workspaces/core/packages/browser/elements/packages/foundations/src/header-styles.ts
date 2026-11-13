import * as stylex from '@stylexjs/stylex';
import { conditions } from './constants.stylex.ts';
import { colors, controls, pageGeometry } from './tokens.stylex.ts';

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

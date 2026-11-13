import * as stylex from '@stylexjs/stylex';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, pageGeometry, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const insetFocusOffset = -2;

export const tabStyles = stylex.create({
  list: {
    'display': 'flex',
    'gap': 0,
    'minWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'overflowX': 'auto',
    ':is([data-orientation="vertical"])': {
      flexDirection: 'column',
      flexShrink: 0,
      maxWidth: '50%',
      borderBottomWidth: 0,
      borderInlineEndWidth: 1,
      borderInlineEndStyle: 'solid',
      borderInlineEndColor: colors.line,
    },
  },
  item: {
    'position': 'relative',
    'boxSizing': 'border-box',
    'display': 'inline-flex',
    'alignItems': 'center',
    'textDecorationLine': 'none',
    'flexShrink': 0,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'WebkitFontSmoothing': 'antialiased',
    'borderWidth': 0,
    'minHeight': pageGeometry.toolbarHeight,
    'paddingBlock': spacing.sm,
    'paddingInline': spacing.md,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'whiteSpace': 'nowrap',
    ':hover:not([data-disabled])': { color: { [conditions.hoverPointer]: colors.ink } },
    ':active:not([data-disabled])': { backgroundColor: colors.canvas, color: colors.ink },
    '::after': {
      content: '""',
      position: 'absolute',
      insetInline: spacing.md,
      bottom: 0,
      height: 2,
      backgroundColor: 'transparent',
    },
    ':is([data-active], [aria-current="page"])': { 'color': colors.ink, '::after': { backgroundColor: colors.ink } },
    ':is([data-orientation="vertical"])': {
      'textAlign': 'start',
      'whiteSpace': 'normal',
      'overflowWrap': 'anywhere',
      '::after': {
        insetInlineStart: 'auto',
        insetInlineEnd: 0,
        top: spacing.sm,
        bottom: spacing.sm,
        width: 2,
        height: 'auto',
      },
    },
    ':is([data-disabled])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: insetFocusOffset,
    },
  },
});

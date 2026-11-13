import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, controls } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  cursor: {
    visibility: { default: 'hidden', [stylex.when.ancestor(':focus-visible')]: 'visible' },
    stroke: { 'default': colors.ink, '@media (forced-colors: active)': 'Highlight' },
    pointerEvents: 'none',
  },
  guide: { strokeWidth: 1, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
  underline: { strokeWidth: controls.focusWidth, vectorEffect: 'non-scaling-stroke' },
});

export function ChartCursor({
  x,
  top,
  bottom,
  width,
}: {
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
}): ReactNode {
  return (
    <g aria-hidden {...stylex.props(styles.cursor)}>
      <line x1={x} x2={x} y1={top} y2={bottom} {...stylex.props(styles.guide)} />
      <line x1={x - width / 2} x2={x + width / 2} y1={bottom + 4} y2={bottom + 4} {...stylex.props(styles.underline)} />
    </g>
  );
}

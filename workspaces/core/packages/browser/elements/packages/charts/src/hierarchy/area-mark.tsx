import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import type { AreaCell } from './treemap-layout.ts';

const styles = stylex.create({
  label: { fill: colors.ink, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
  rect: { stroke: colors.surface, strokeWidth: 1, fillOpacity: 0.24 },
  fill: (color: string) => ({ fill: color }),
  cursor: { fill: 'none', pointerEvents: 'none' },
});

const LABEL_INSET = 8;
const FIRST_BASELINE = 18;
const SECOND_BASELINE = 34;
const SECOND_LINE_HEIGHT = 40;
const CHARACTER_WIDTH = 6.5;
const VALUE_CHARACTER_WIDTH = 12;
const SINGLE_LINE_HEIGHT = 22;

export type AreaMarkProps = {
  readonly cell: AreaCell;
  readonly tone: ChartTone;
  readonly label: string;
  /** The exact value, drawn under the label when the area has room. */
  readonly valueLabel: string;
  /** The narrowest area that names itself. Narrower areas stay unlabeled; the readout and table still name them. */
  readonly labelWidth: number;
  readonly isInspected?: boolean | undefined;
  readonly isSelected?: boolean | undefined;
  readonly isCursor?: boolean | undefined;
};

/** One area of a hierarchy chart: a pale fill in its tone, a surface edge, and its name and value where they fit. */
export function AreaMark({
  cell,
  tone,
  label,
  valueLabel,
  labelWidth,
  isInspected = false,
  isSelected = false,
  isCursor = false,
}: AreaMarkProps): ReactNode {
  const width = cell.x1 - cell.x0;
  const height = cell.y1 - cell.y0;
  const hasLabelRoom = width > labelWidth && height >= SINGLE_LINE_HEIGHT;
  const characters = Math.max(1, Math.floor((width - LABEL_INSET * 2) / CHARACTER_WIDTH));
  const shown = label.length > characters ? `${label.slice(0, characters - 1)}…` : label;
  const isSingleLine = height < SECOND_LINE_HEIGHT;
  const hasValueRoom = !isSingleLine && valueLabel.length * VALUE_CHARACTER_WIDTH < width - LABEL_INSET * 2;
  const baseline = isSingleLine ? height / 2 + 4 : FIRST_BASELINE;

  return (
    <g>
      <rect
        x={cell.x0}
        y={cell.y0}
        width={Math.max(0, width)}
        height={Math.max(0, height)}
        {...stylex.props(
          styles.rect,
          styles.fill(chartToneColors[tone]),
          isInspected && chartStyles.inspected,
          isSelected && chartStyles.selected,
        )}
      >
        <title>{`${label}: ${valueLabel}`}</title>
      </rect>
      {isCursor && (
        <rect
          x={cell.x0 + 2}
          y={cell.y0 + 2}
          width={Math.max(0, width - 4)}
          height={Math.max(0, height - 4)}
          {...stylex.props(styles.cursor, chartStyles.shapeCursor)}
        />
      )}
      {hasLabelRoom && (
        <svg x={cell.x0} y={cell.y0} width={width} height={height} overflow="hidden" aria-hidden>
          <text x={LABEL_INSET} y={baseline} {...stylex.props(styles.label)}>
            {shown}
          </text>
          {hasValueRoom && (
            <text x={LABEL_INSET} y={SECOND_BASELINE} {...stylex.props(styles.label)}>
              {valueLabel}
            </text>
          )}
        </svg>
      )}
    </g>
  );
}

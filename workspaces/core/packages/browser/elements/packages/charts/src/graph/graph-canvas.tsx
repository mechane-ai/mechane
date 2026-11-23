import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import type { KeyboardEventHandler, ReactNode, Ref } from 'react';
import { colors, controls } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import { ChartPlot, plotLabel } from '../chart.tsx';

const CHARACTER_WIDTH = 6;
const ELLIPSIS = '…';
const SCROLL_MARGIN = 32;
const VIEWPORT_HEIGHT_MAX = 560;

const styles = stylex.create({
  measure: { minWidth: 0, contain: 'inline-size' },
  viewport: {
    'overflow': 'auto',
    'maxHeight': VIEWPORT_HEIGHT_MAX,
    'minWidth': 0,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  svg: { display: 'block' },
  ring: { fill: 'none', pointerEvents: 'none' },
});

/** A point in a graph's own pixels, such as the node the keyboard cursor rests on. */
export type GraphPoint = { readonly x: number; readonly y: number };

export type GraphCanvasProps = {
  /** The ref from `usePlotSize`, on the element whose width the layout fills. */
  readonly plotRef: Ref<HTMLDivElement>;
  readonly title: string;
  /** What the arrow keys step through, such as "nodes". */
  readonly marks: string;
  readonly readoutId: string;
  readonly isSelectable: boolean;
  /** The size the layout drew, which may be larger than the frame: the canvas then scrolls inside it. */
  readonly width: number;
  readonly height: number;
  /** Where the keyboard cursor rests. While the plot has focus the canvas scrolls to keep it in view. */
  readonly cursor: GraphPoint | undefined;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement> | undefined;
  readonly children: ReactNode;
};

/**
 * The plot of a node-link figure: one Tab stop that scrolls inside the frame when the layout is larger than it, and
 * keeps the keyboard cursor in view. It never zooms. Use it inside `Chart`, which supplies the items.
 */
export function GraphCanvas({
  plotRef,
  title,
  marks,
  readoutId,
  isSelectable,
  width,
  height,
  cursor,
  onKeyDown,
  children,
}: GraphCanvasProps): ReactNode {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cursorX = cursor?.x;
  const cursorY = cursor?.y;

  useEffect(() => {
    const viewport = viewportRef.current;

    if (viewport === null || cursorX === undefined || cursorY === undefined) {
      return;
    }

    if (!viewport.contains(viewport.ownerDocument.activeElement)) {
      return;
    }

    const left = Math.min(
      cursorX - SCROLL_MARGIN,
      Math.max(viewport.scrollLeft, cursorX + SCROLL_MARGIN - viewport.clientWidth),
    );

    const top = Math.min(
      cursorY - SCROLL_MARGIN,
      Math.max(viewport.scrollTop, cursorY + SCROLL_MARGIN - viewport.clientHeight),
    );

    viewport.scrollTo({ left, top });
  }, [cursorX, cursorY]);

  return (
    <div ref={plotRef} onKeyDown={onKeyDown} {...stylex.props(styles.measure)}>
      <ChartPlot
        ref={viewportRef}
        role="group"
        aria-label={plotLabel({ title, marks, isSelectable })}
        aria-describedby={readoutId}
        {...stylex.props(styles.viewport, stylex.defaultMarker())}
      >
        <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} {...stylex.props(styles.svg)}>
          {children}
        </svg>
      </ChartPlot>
    </div>
  );
}

/** The keyboard cursor around a node: a dashed ring, shown while the plot has keyboard focus. */
export function GraphCursor({ x, y, radius }: GraphPoint & { readonly radius: number }): ReactNode {
  return <circle cx={x} cy={y} r={radius} {...stylex.props(chartStyles.shapeCursor, styles.ring)} />;
}

/** A label shortened with an ellipsis to fit a width in pixels. The readout and data table keep the full text. */
export function fitLabel(label: string, width: number): string {
  const characters = Math.max(1, Math.floor(width / CHARACTER_WIDTH));

  return label.length > characters ? `${label.slice(0, Math.max(0, characters - 1))}${ELLIPSIS}` : label;
}

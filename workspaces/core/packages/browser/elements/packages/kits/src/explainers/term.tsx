import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { chartToneColors, useScopedTone } from '../../../charts/src/index.ts';
import { colors, controls, radii } from '../../../foundations/src/tokens.stylex.ts';
import { useLinkedTarget } from './linked-target.ts';

const HINT = 'Highlights it in the figures.';
const pressKeys: ReadonlySet<string> = new Set(['Enter', ' ']);

const styles = stylex.create({
  term: (color: string) => ({
    'display': 'inline',
    'margin': 0,
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': 'inherit',
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'fontWeight': 'inherit',
    'lineHeight': 'inherit',
    'textAlign': 'inherit',
    'cursor': 'pointer',
    'textDecorationLine': 'underline',
    'textDecorationStyle': 'dotted',
    'textDecorationThickness': 2,
    'textDecorationColor': color,
    'textUnderlineOffset': '0.25em',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  }),
  inspected: (color: string) => ({
    textDecorationStyle: 'solid',
    backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
  }),
  part: (color: string) => ({
    color,
    'stroke': 'currentColor',
    'strokeWidth': 1.5,
    'fill': 'color-mix(in srgb, currentColor 8%, transparent)',
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':focus-visible': { strokeWidth: 3, strokeDasharray: '4 2' },
  }),
  partInspected: { strokeWidth: 3, fill: 'color-mix(in srgb, currentColor 22%, transparent)' },
});

function useToneColor(id: string, fallback: string): string {
  const tone = useScopedTone(id);

  return tone === undefined ? fallback : chartToneColors[tone];
}

export type TermProps = {
  /** The record the term names, by the id the figures use for it: a series, a run, a step. */
  readonly inspects: string;
  /** The words in the sentence. */
  readonly children: ReactNode;
};

/**
 * A word in prose that points into the figures: hovering or focusing "the base run" highlights that run in every chart
 * of the enclosing `ChartLink`. A press does the same on touch. Its dotted underline takes the record's hue when a
 * `ToneScope` names it, so the sentence doubles as a legend.
 */
export function Term({ inspects, children }: TermProps): ReactNode {
  const { isInspected, handlers } = useLinkedTarget(inspects);
  const color = useToneColor(inspects, colors.muted);
  const hintId = useId();

  return (
    <>
      <button
        type="button"
        aria-describedby={hintId}
        {...handlers}
        {...stylex.props(styles.term(color), isInspected && styles.inspected(color))}
      >
        {children}
      </button>
      <span id={hintId} hidden>
        {HINT}
      </span>
    </>
  );
}

export type DiagramPartProps = {
  /** The record this part of the diagram stands for, by the id the figures and terms use for it. */
  readonly inspects: string;
  /** What the part is, for a reader who cannot see it: "Attention layer". */
  readonly label: string;
  /**
   * The part's shapes. Draw them without their own stroke, stroke width or fill and they take the part's hue, and its
   * emphasis while the link inspects this record.
   */
  readonly children: ReactNode;
};

/**
 * A part of a hand-drawn SVG diagram linked to the figures both ways: pointing at it or focusing it highlights its
 * record in every chart of the enclosing `ChartLink`. It is emphasized whenever a chart or a `Term` inspects it.
 */
export function DiagramPart({ inspects, label, children }: DiagramPartProps): ReactNode {
  const { isInspected, handlers, press } = useLinkedTarget(inspects);
  const color = useToneColor(inspects, colors.muted);
  const hintId = useId();

  function onKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if (pressKeys.has(event.key)) {
      event.preventDefault();
      press(event.nativeEvent);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-describedby={hintId}
      data-inspected={isInspected ? '' : undefined}
      {...handlers}
      onKeyDown={onKeyDown}
      {...stylex.props(styles.part(color), isInspected && styles.partInspected)}
    >
      <desc id={hintId}>{HINT}</desc>
      {children}
    </g>
  );
}

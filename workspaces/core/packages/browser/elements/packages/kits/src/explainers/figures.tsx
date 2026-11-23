import * as stylex from '@stylexjs/stylex';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

const FigureOrder = createContext<ReadonlyArray<string> | undefined>(undefined);

const styles = stylex.create({
  figure: { display: 'grid', gap: spacing.sm, minWidth: 0, margin: 0, scrollMarginBlockStart: spacing.xl },
  caption: {
    margin: 0,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  number: { color: colors.ink, fontWeight: typography.strongWeight },
  reference: {
    'color': 'inherit',
    'textDecorationLine': 'underline',
    'textDecorationColor': colors.faint,
    'textUnderlineOffset': '0.2em',
    'borderRadius': radii.sm,
    ':hover': { textDecorationColor: { [conditions.hoverPointer]: colors.ink } },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  error: { color: colors.danger, fontWeight: typography.strongWeight },
});

/** A figure's number in its explainer, counted from 1, or undefined when the explainer does not list it. */
function useFigureNumber(id: string): number | undefined {
  const index = useContext(FigureOrder)?.indexOf(id) ?? -1;

  return index === -1 ? undefined : index + 1;
}

function missingText(id: string): string {
  return `Unknown figure "${id}": add it to the explainer's figures`;
}

export type ExplainerProps = {
  /** The id of every numbered figure, in reading order. Numbers come from this list, so server and browser agree. */
  readonly figures: ReadonlyArray<string>;
  /** The article: prose, figures and references in any arrangement. */
  readonly children: ReactNode;
};

/**
 * A long page whose figures are numbered and referred to by number, like a paper. List the figure ids in reading order;
 * each `NumberedFigure` shows its number and each `FigureReference` links to it.
 */
export function Explainer({ figures, children }: ExplainerProps): ReactNode {
  return <FigureOrder value={figures}>{children}</FigureOrder>;
}

export type NumberedFigureProps = {
  /** The figure's id in the explainer's list. It is also the element id, so `#id` links land on the figure. */
  readonly id: string;
  /** What the reader should see in the figure, after its number. */
  readonly caption: ReactNode;
  /** The chart, diagram or image. */
  readonly children: ReactNode;
};

/**
 * A chart or diagram with its number and caption below it: "Figure 2. Loss falls faster for the wide run." A figure the
 * explainer does not list says so in place of its number.
 */
export function NumberedFigure({ id, caption, children }: NumberedFigureProps): ReactNode {
  const number = useFigureNumber(id);

  return (
    <figure id={id} {...stylex.props(styles.figure)}>
      {children}
      <figcaption {...stylex.props(styles.caption)}>
        {number === undefined ? (
          <span {...stylex.props(styles.error)}>{missingText(id)}</span>
        ) : (
          <>
            <span {...stylex.props(styles.number)}>{`Figure ${number}.`}</span> {caption}
          </>
        )}
      </figcaption>
    </figure>
  );
}

export type FigureReferenceProps = {
  /** The id of the figure the reference points to. */
  readonly to: string;
};

/** "Figure 2" in prose, as a link that moves the reader to that figure. An unknown id shows an error in its place. */
export function FigureReference({ to }: FigureReferenceProps): ReactNode {
  const number = useFigureNumber(to);

  if (number === undefined) {
    return <span {...stylex.props(styles.error)}>{missingText(to)}</span>;
  }

  return <a href={`#${encodeURIComponent(to)}`} {...stylex.props(styles.reference)}>{`Figure ${number}`}</a>;
}

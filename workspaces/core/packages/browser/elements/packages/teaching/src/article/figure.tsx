import * as stylex from '@stylexjs/stylex';
import { createContext, use, useId } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { LessonError } from '../lesson/lesson-error.tsx';
import { useArticle, useBeat } from './article-context.ts';
import { BlockError, outsideText, unlistedText } from './article-error.tsx';
import { articleLayout } from './article-layout.stylex.ts';

const styles = stylex.create({
  figure: {
    display: 'grid',
    gap: spacing.sm,
    minWidth: 0,
    marginInline: 0,
    marginBlock: spacing.xl,
    clear: 'both',
    scrollMarginBlockStart: spacing.xl,
    breakInside: 'avoid',
  },
  cell: { marginBlock: 0 },
  caption: {
    margin: 0,
    maxWidth: articleLayout.measure,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  number: { color: colors.ink, fontWeight: typography.strongWeight },
  description: {
    margin: 0,
    maxWidth: articleLayout.measure,
    color: colors.ink,
    fontSize: typography.inputSize,
    lineHeight: typography.proseLineHeight,
  },
  descriptionLabel: { fontWeight: typography.strongWeight },
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
  reveal: { display: 'contents' },
});

/** True inside a repeated copy of a figure, such as a scrolly's figure at each step, so only the first keeps its id. */
export const FigureCopy = createContext(false);

/** True inside a part that already sets its figure's width, such as a scrolly, so the figure never widens again. */
export const FigureColumn = createContext(false);

/** How wide a figure is: the text column, or the text and its margin on wide screens. */
export type FigureSize = 'text' | 'wide';

const sizes = stylex.create({
  text: {},
  wide: { marginInlineEnd: { default: 0, [articleLayout.withMargin]: `calc(-1 * ${articleLayout.marginSpan})` } },
});

export type FigureProps = {
  /** The figure's id, unique in the article. It is the element id, so `#id` links land on the figure. */
  readonly id: string;
  /** What the reader should see in the figure, after its number. */
  readonly caption: ReactNode;
  /** The figure in words, for a reader who cannot see it. The static view prints it after the figure. */
  readonly description?: string | undefined;
  /**
   * The lesson values the figure reads, when its markup does not name them through `Param`, `Value` or a control. The
   * beat sheet uses them to find prose controls that change no figure.
   */
  readonly reads?: ReadonlyArray<string> | undefined;
  /** Wide figures, the default, reach into the margin column on wide screens. */
  readonly size?: FigureSize | undefined;
  /** The chart, scene or image. */
  readonly children: ReactNode;
};

/** A figure's number in its article, counted from 1 in reading order, or undefined when the article has none. */
function useFigureNumber(id: string): number | undefined {
  const index = useArticle()?.outline.figures.indexOf(id) ?? -1;

  return index === -1 ? undefined : index + 1;
}

function missingText(id: string): string {
  return `Unknown figure "${id}": no Figure in the article has this id.`;
}

/**
 * A chart, scene or image with its number and caption: "Figure 2. Lower temperatures sharpen the distribution." Figures
 * are numbered in reading order. Give each a `description` so the static view and assistive technology can say what it
 * shows.
 */
export function Figure({ id, caption, description, size = 'wide', children }: FigureProps): ReactNode {
  const article = useArticle();
  const number = useFigureNumber(id);
  const descriptionId = useId();
  const isCopy = use(FigureCopy);
  const isInColumn = use(FigureColumn);

  if (article === null) {
    return <BlockError>{outsideText('Figure')}</BlockError>;
  }

  const { view, labels } = article;
  const isCell = view === 'sheet';
  const isDescriptionShown = view === 'static';
  const hasDescription = description !== undefined;

  return (
    <figure
      id={isCell || isCopy ? undefined : id}
      aria-describedby={hasDescription ? descriptionId : undefined}
      {...stylex.props(styles.figure, !isCell && sizes[isInColumn ? 'text' : size], isCell && styles.cell)}
    >
      {children}
      <figcaption {...stylex.props(styles.caption)}>
        {number === undefined ? (
          <LessonError>{unlistedText('Figure', id)}</LessonError>
        ) : (
          <>
            <span {...stylex.props(styles.number)}>{`${labels.figure} ${number}.`}</span> {caption}
          </>
        )}
      </figcaption>
      {hasDescription ? (
        <p id={descriptionId} {...stylex.props(styles.description, !isDescriptionShown && accessibility.hidden)}>
          <span {...stylex.props(styles.descriptionLabel)}>{`${labels.figureDescription}: `}</span>
          {description}
        </p>
      ) : null}
    </figure>
  );
}

export type FigureReferenceProps = {
  /** The id of the figure the reference points to. */
  readonly to: string;
};

/** "Figure 2" in prose, as a link that moves the reader to that figure. An unknown id shows an error in its place. */
export function FigureReference({ to }: FigureReferenceProps): ReactNode {
  const article = useArticle();
  const number = useFigureNumber(to);

  if (number === undefined || article === null) {
    return <LessonError>{article === null ? outsideText('FigureReference') : missingText(to)}</LessonError>;
  }

  return (
    <a href={`#${encodeURIComponent(to)}`} {...stylex.props(styles.reference)}>
      {`${article.labels.figure} ${number}`}
    </a>
  );
}

export type RevealProps = {
  /** The reveal step of the beat from which this content shows, counted from 0. */
  readonly at: number;
  readonly children: ReactNode;
};

/**
 * Whether reveal step `at` of the surrounding beat shows now, for a figure that reveals its own parts. It is true in
 * the article, static and sheet views and outside a beat; in the present view it follows the beat's reveal step.
 */
export function useRevealed(at: number): boolean {
  const article = useArticle();
  const beat = useBeat();

  if (article?.view !== 'present' || beat === null) {
    return true;
  }

  return beat.isCurrent && beat.step >= at;
}

/**
 * Content that appears at a reveal step of its beat in the present view, where Right or Space shows the next step. The
 * article and static views show it at once, so a scrolling reader and a printed page lose nothing.
 */
export function Reveal({ at, children }: RevealProps): ReactNode {
  const article = useArticle();
  const beat = useBeat();
  const isRevealed = useRevealed(at);

  if (article === null || beat === null) {
    return <BlockError>{article === null ? outsideText('Reveal') : 'Reveal must sit inside a Beat.'}</BlockError>;
  }

  const steps = article.lesson.beats.find((item) => item.id === beat.id)?.steps ?? 0;
  const isKnownStep = Number.isInteger(at) && at >= 0 && at <= steps;

  if (!isKnownStep) {
    return <BlockError>{`Reveal at ${at}, but beat "${beat.id}" has reveal steps 0 to ${steps}.`}</BlockError>;
  }

  const isHidden = !isRevealed;

  return (
    <div hidden={isHidden} data-reveal-at={at} {...stylex.props(!isHidden && styles.reveal)}>
      {children}
    </div>
  );
}

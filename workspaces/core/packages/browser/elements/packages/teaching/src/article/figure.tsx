import * as stylex from '@stylexjs/stylex';
import { createContext, use, useId } from 'react';
import type { ReactNode } from 'react';
import { CaptionScope } from '../../../charts/src/index.ts';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { LessonError } from '../lesson/lesson-error.tsx';
import { useArticle, useBeat } from './article-context.ts';
import { BlockError, outsideText, unlistedText } from './article-error.tsx';
import { articleLayout, articleSticky, framedFigure } from './article-layout.stylex.ts';

const styles = stylex.create({
  figure: {
    display: 'grid',
    gap: spacing.sm,
    minWidth: 0,
    marginInline: 0,
    marginBlock: spacing.xl,
    clear: 'both',
    scrollMarginBlockStart: `calc(${articleSticky.top} + ${spacing.xl})`,
    breakInside: 'avoid',
  },
  cell: { marginBlock: 0 },
  /** The hairline frame. A chart's report frame inside stands in for it, so the frame and its rules give way. */
  frame: {
    display: 'grid',
    minWidth: 0,
    borderWidth: { 'default': 1, ':has([data-figure-report])': 0 },
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  strip: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    minWidth: 0,
    paddingBlock: spacing.sm,
    paddingInline: { default: spacing.md, [articleLayout.withMargin]: spacing.lg },
    borderColor: colors.line,
    borderStyle: 'solid',
    borderWidth: 0,
  },
  top: { borderBlockEndWidth: { default: 1, [stylex.when.ancestor(':has([data-figure-report])', framedFigure)]: 0 } },
  bottom: {
    borderBlockStartWidth: { default: 1, [stylex.when.ancestor(':has([data-figure-report])', framedFigure)]: 0 },
  },
  visual: {
    minWidth: 0,
    padding: {
      default: spacing.md,
      [articleLayout.withMargin]: {
        default: spacing.lg,
        [stylex.when.ancestor(':has([data-figure-report])', framedFigure)]: 0,
      },
      [stylex.when.ancestor(':has([data-figure-report])', framedFigure)]: 0,
    },
  },
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

/** The frame a figure takes: given a strip it is framed, and without one `isFramed` frames the visual alone. */
export type FigureFraming =
  | {
      /** Frames a figure that has no strip, so it matches the framed figures beside it. Defaults to false. */
      readonly isFramed?: boolean | undefined;
      readonly header?: undefined;
      readonly footer?: undefined;
    }
  | {
      /** A figure with a strip is always framed: its controls belong to the frame. */
      readonly isFramed?: true | undefined;
      /**
       * Controls above the visual, such as a `Transport`. Given this or `footer`, the figure sits in a hairline frame
       * with a strip for each, ruled off from the visual.
       */
      readonly header?: ReactNode;
      /** Controls below the visual, such as a `ParamChoice` or a reset button, in the framed figure's bottom strip. */
      readonly footer?: ReactNode;
    };

export type FigureProps = FigureFraming & {
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
  /** The chart, scene or image. A chart or scene inside keeps its title as its name and prints only the caption. */
  readonly children: ReactNode;
};

/** The views where a figure's controls cannot act, so its strips are inert. */
const frozenViews: ReadonlySet<string> = new Set(['static', 'sheet']);

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
export function Figure({
  id,
  caption,
  description,
  size = 'wide',
  header,
  footer,
  isFramed: isFramedProp,
  children,
}: FigureProps): ReactNode {
  const article = useArticle();
  const number = useFigureNumber(id);
  const descriptionId = useId();
  const isCopy = use(FigureCopy);
  const isInColumn = use(FigureColumn);

  const hasStrip = header !== undefined || footer !== undefined;

  if (article === null) {
    return <BlockError>{outsideText('Figure')}</BlockError>;
  }

  // The type forbids this; MDX does not check types, so an essay written there learns it here.
  if (isFramedProp === false && hasStrip) {
    return (
      <BlockError>A Figure with a header or footer keeps its frame, so it cannot set isFramed to false.</BlockError>
    );
  }

  const { view, labels } = article;
  const isCell = view === 'sheet';
  const isDescriptionShown = view === 'static';
  const hasDescription = description !== undefined;
  const isFramed = isFramedProp ?? hasStrip;
  const isFrozen = frozenViews.has(view);
  const visual = <CaptionScope>{children}</CaptionScope>;

  return (
    <figure
      id={isCell || isCopy ? undefined : id}
      aria-describedby={hasDescription ? descriptionId : undefined}
      {...stylex.props(styles.figure, !isCell && sizes[isInColumn ? 'text' : size], isCell && styles.cell)}
    >
      {isFramed ? (
        <div {...stylex.props(styles.frame, framedFigure)}>
          {header === undefined ? null : (
            <div inert={isFrozen} {...stylex.props(styles.strip, styles.top)}>
              {header}
            </div>
          )}
          <div {...stylex.props(styles.visual)}>{visual}</div>
          {footer === undefined ? null : (
            <div inert={isFrozen} {...stylex.props(styles.strip, styles.bottom)}>
              {footer}
            </div>
          )}
        </div>
      ) : (
        visual
      )}
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

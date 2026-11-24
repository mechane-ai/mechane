import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { LessonError } from '../lesson/lesson-error.tsx';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { useArticle } from './article-context.ts';
import { BlockError, outsideText } from './article-error.tsx';
import { articleLayout, articleSticky } from './article-layout.stylex.ts';
import type { ReferenceItem } from './outline-types.ts';

const focusRing = {
  outlineWidth: controls.focusWidth,
  outlineStyle: 'solid',
  outlineColor: colors.focus,
  outlineOffset: 2,
} as const;

const styles = stylex.create({
  aside: {
    display: 'block',
    boxSizing: 'border-box',
    marginBlock: spacing.lg,
    paddingInlineStart: { default: spacing.md, [articleLayout.withMargin]: 0 },
    borderInlineStartWidth: { default: 2, [articleLayout.withMargin]: 0 },
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    color: colors.muted,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    float: { default: 'none', [articleLayout.withMargin]: 'right' },
    clear: 'right',
    width: { default: 'auto', [articleLayout.withMargin]: articleLayout.marginWidth },
    marginBlockStart: { default: spacing.lg, [articleLayout.withMargin]: spacing.xs },
    marginInlineEnd: { default: 0, [articleLayout.withMargin]: `calc(-1 * ${articleLayout.marginSpan})` },
  },
  mark: {
    'marginInlineStart': spacing.xxs,
    'color': colors.accent,
    'fontSize': typography.captionSize,
    'fontVariantNumeric': 'tabular-nums',
    'textDecorationLine': 'none',
    'borderRadius': radii.sm,
    ':hover': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':focus-visible': focusRing,
  },
  sup: { lineHeight: 0 },
  hidden: { display: 'none' },
  section: {
    display: 'grid',
    gap: spacing.sm,
    maxWidth: articleLayout.measure,
    marginBlockStart: spacing.xxl,
    paddingBlockStart: spacing.lg,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: colors.line,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  heading: {
    margin: 0,
    color: colors.ink,
    fontSize: typography.inputSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: typography.strongWeight,
  },
  list: { display: 'grid', gap: spacing.sm, margin: 0, paddingInlineStart: spacing.xl },
  item: { scrollMarginBlockStart: `calc(${articleSticky.top} + ${spacing.xl})`, paddingInlineStart: spacing.xs },
  slide: {
    gap: spacing.xs,
    marginBlockStart: spacing.lg,
    paddingBlockStart: spacing.sm,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  slideList: { gap: spacing.xxs },
  slideHeading: { fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  back: {
    'marginInlineStart': spacing.xs,
    'color': colors.accent,
    'textDecorationLine': 'none',
    'borderRadius': radii.sm,
    ':focus-visible': focusRing,
  },
  title: { color: colors.ink },
  link: {
    'color': 'inherit',
    'overflowWrap': 'anywhere',
    'textDecorationColor': colors.faint,
    'borderRadius': radii.sm,
    ':focus-visible': focusRing,
  },
});

export type AsideProps = { readonly children: ReactNode };

/** A note beside the text: in the margin on wide screens, an indented block between paragraphs on narrow ones. */
export function Aside({ children }: AsideProps): ReactNode {
  return <aside {...stylex.props(styles.aside)}>{children}</aside>;
}

export type FootnoteProps = {
  /** The note's id, unique in the article. Its number comes from reading order. */
  readonly id: string;
  /** The note, collected at the end of the article. */
  readonly children: ReactNode;
};

function footnoteTarget(id: string): string {
  return `fn-${id}`;
}

function footnoteSource(id: string): string {
  return `fnref-${id}`;
}

/** A numbered note: a small number in the sentence that links to the note at the end, and back. */
export function Footnote({ id }: FootnoteProps): ReactNode {
  const article = useArticle();

  if (article === null) {
    return <LessonError>{outsideText('Footnote')}</LessonError>;
  }

  const number = article.outline.footnotes.findIndex((item) => item.id === id) + 1;

  return (
    <sup {...stylex.props(styles.sup)}>
      <a
        id={article.view === 'sheet' ? undefined : footnoteSource(id)}
        href={`#${footnoteTarget(id)}`}
        aria-label={`${article.labels.note} ${number}`}
        {...stylex.props(styles.mark)}
      >
        {number}
      </a>
    </sup>
  );
}

export type ArticleNotesProps = {
  /** Only the notes of this beat, small, for its slide in the present view. Every note when left out. */
  readonly beat?: string | undefined;
};

/** The notes of an article, in reading order, each linked back to its place in the text. Numbers stay article-wide. */
export function ArticleNotes({ beat }: ArticleNotesProps): ReactNode {
  const article = useArticle();
  const headingId = useId();
  const all = article?.outline.footnotes ?? [];
  const notes = beat === undefined ? all : all.filter((note) => note.beat === beat);
  const isSlide = beat !== undefined;

  if (article === null || notes.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} {...stylex.props(styles.section, isSlide && styles.slide)}>
      <h2 id={headingId} {...stylex.props(styles.heading, isSlide && styles.slideHeading)}>
        {article.labels.notes}
      </h2>
      <ol {...stylex.props(styles.list, isSlide && styles.slideList)}>
        {notes.map((note) => (
          <li key={note.id} id={footnoteTarget(note.id)} value={all.indexOf(note) + 1} {...stylex.props(styles.item)}>
            {note.content}
            <a
              href={`#${footnoteSource(note.id)}`}
              aria-label={article.labels.backToText}
              {...stylex.props(styles.back)}
            >
              ↩
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function referenceTarget(id: string): string {
  return `ref-${id}`;
}

export type CiteProps = {
  /** The id of an item in the article's `References`. */
  readonly id: string;
};

/** A citation in the text: the work's number in the references, linked to it. An unknown id shows an inline error. */
export function Cite({ id }: CiteProps): ReactNode {
  const article = useArticle();

  if (article === null) {
    return <LessonError>{outsideText('Cite')}</LessonError>;
  }

  const { references } = article.outline;
  const index = references.findIndex((item) => item.id === id);
  const item = references[index];

  if (item === undefined) {
    return <LessonError>{`Unknown reference "${id}": add it to the article's References.`}</LessonError>;
  }

  return (
    <a
      href={`#${referenceTarget(id)}`}
      aria-label={`${item.authors.join(', ')}, ${item.year}`}
      {...stylex.props(styles.mark)}
    >
      {`[${index + 1}]`}
    </a>
  );
}

export type ReferencesProps = {
  /** The works the article cites, in the order they are numbered. */
  readonly items: ReadonlyArray<ReferenceItem>;
};

/**
 * The numbered list of works the article cites. `Cite` links to each by its id; the present view shows it on the last
 * beat.
 */
export function References({ items }: ReferencesProps): ReactNode {
  const article = useArticle();
  const { beat, lesson } = useLessonContext();
  const isHidden = article?.view === 'present' && beat !== lesson.beats.at(-1)?.id;
  const headingId = useId();
  const duplicate = items.find((item, index) => items.findIndex((other) => other.id === item.id) !== index);

  if (article === null || duplicate !== undefined) {
    return (
      <BlockError>
        {article === null ? outsideText('References') : `Two references share the id "${duplicate?.id ?? ''}".`}
      </BlockError>
    );
  }

  return (
    <section aria-labelledby={headingId} hidden={isHidden} {...stylex.props(styles.section, isHidden && styles.hidden)}>
      <h2 id={headingId} {...stylex.props(styles.heading)}>
        {article.labels.references}
      </h2>
      <ol {...stylex.props(styles.list)}>
        {items.map((item) => (
          <li key={item.id} id={referenceTarget(item.id)} {...stylex.props(styles.item)}>
            {`${item.authors.join(', ')}. ${item.year}. `}
            {item.url === undefined ? (
              <span {...stylex.props(styles.title)}>{item.title}</span>
            ) : (
              <a href={item.url} {...stylex.props(styles.link, styles.title)}>
                {item.title}
              </a>
            )}
            {item.venue === undefined ? '.' : `. ${item.venue}.`}
          </li>
        ))}
      </ol>
    </section>
  );
}

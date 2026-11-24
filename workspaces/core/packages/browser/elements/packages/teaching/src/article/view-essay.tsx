import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useLessonContext } from '../lesson/use-lesson.ts';
import type { ArticleScope } from './article-context.ts';
import { articleLayout } from './article-layout.stylex.ts';
import { lessonBeat } from './beat.tsx';
import { ArticleNotes } from './notes.tsx';

/** The band of the viewport, from the top, where the beat being read sits: a thin line a third of the way down. */
const READING_BAND = '-33% 0px -62% 0px';

const styles = stylex.create({
  layout: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      [articleLayout.withContents]: `${articleLayout.contentsWidth} minmax(0, 1fr)`,
    },
    columnGap: spacing.xxl,
    alignItems: 'start',
  },
  side: {
    display: { default: 'none', [articleLayout.withContents]: 'block' },
    position: 'sticky',
    insetBlockStart: spacing.xl,
    paddingBlockStart: spacing.xs,
  },
  main: { minWidth: 0 },
  compact: {
    display: { default: 'block', [articleLayout.withContents]: 'none' },
    position: 'sticky',
    insetBlockStart: 0,
    zIndex: 2,
    marginBlockEnd: spacing.xl,
    paddingBlock: spacing.sm,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    backgroundColor: colors.surface,
  },
  summary: {
    'display': 'flex',
    'gap': spacing.sm,
    'alignItems': 'baseline',
    'cursor': 'pointer',
    'color': colors.ink,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'borderRadius': radii.sm,
    ':focus-visible': { outlineWidth: controls.focusWidth, outlineStyle: 'solid', outlineColor: colors.focus },
  },
  summaryLabel: { color: colors.muted, flexShrink: 0 },
  summaryBeat: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: typography.mediumWeight,
  },
  heading: {
    margin: 0,
    marginBlockEnd: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.strongWeight,
  },
  list: { display: 'grid', gap: spacing.xxs, margin: 0, padding: 0, listStyleType: 'none' },
  compactList: { paddingBlockStart: spacing.sm },
  link: {
    'display': 'block',
    'paddingBlock': spacing.xs,
    'paddingInlineStart': spacing.md,
    'borderInlineStartWidth': 2,
    'borderInlineStartStyle': 'solid',
    'borderInlineStartColor': colors.line,
    'color': colors.muted,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'textDecorationLine': 'none',
    ':hover': { color: { default: colors.muted, [conditions.hoverPointer]: colors.ink } },
    ':focus-visible': { outlineWidth: controls.focusWidth, outlineStyle: 'solid', outlineColor: colors.focus },
  },
  current: { borderInlineStartColor: colors.ink, color: colors.ink, fontWeight: typography.mediumWeight },
});

type ContentsBeat = { readonly id: string; readonly title: string };

function ContentsList({
  beats,
  current,
  isCompact,
  onPick,
}: {
  readonly beats: ReadonlyArray<ContentsBeat>;
  readonly current: string | null;
  readonly isCompact: boolean;
  readonly onPick?: (() => void) | undefined;
}): ReactNode {
  return (
    <ol {...stylex.props(styles.list, isCompact && styles.compactList)}>
      {beats.map((beat) => (
        <li key={beat.id}>
          <a
            href={`#${encodeURIComponent(beat.id)}`}
            aria-current={beat.id === current ? 'location' : undefined}
            onClick={onPick}
            {...stylex.props(styles.link, beat.id === current && styles.current)}
          >
            {beat.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export type ViewProps = {
  readonly article: ArticleScope;
  /** The title, byline and summary. */
  readonly header: ReactNode;
  readonly children: ReactNode;
};

/**
 * The article view: a scrolling essay with a contents list that follows the reading position. Scrolling a beat into the
 * reading band makes it the lesson's beat, and a beat set elsewhere, such as by an agent, scrolls into view.
 */
export function EssayView({ article, header, children }: ViewProps): ReactNode {
  const { beat, goTo } = useLessonContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const latest = useRef({ beat, goTo, scrolled: beat });

  const beats = article.outline.beats.flatMap((item) => {
    const declared = lessonBeat(article.lesson, item.id);

    return declared === undefined ? [] : [{ id: declared.id, title: declared.title }];
  });

  const currentTitle = beats.find((item) => item.id === beat)?.title ?? beats[0]?.title ?? '';

  useEffect(() => {
    latest.current.beat = beat;
    latest.current.goTo = goTo;

    const root = rootRef.current;

    if (beat === null || beat === latest.current.scrolled || root === null) {
      return;
    }

    latest.current.scrolled = beat;

    root.querySelector(`[data-beat="${CSS.escape(beat)}"]`)?.scrollIntoView({ block: 'start' });
  });

  useEffect(() => {
    const root = rootRef.current;

    if (root === null) {
      return;
    }

    const known = new Set(article.lesson.beats.map((item) => item.id));

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries.find((entry) => entry.isIntersecting)?.target;
        const shown = target instanceof HTMLElement ? target.dataset['beat'] : undefined;

        if (shown === undefined || !known.has(shown)) {
          return;
        }

        latest.current.scrolled = shown;

        if (shown !== latest.current.beat) {
          latest.current.goTo(shown, 0, { reason: 'scroll' });
        }
      },
      { rootMargin: READING_BAND },
    );

    for (const element of root.querySelectorAll('[data-beat]')) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [article.lesson]);

  return (
    <div ref={rootRef} {...stylex.props(styles.layout)}>
      <nav aria-label={article.labels.contents} {...stylex.props(styles.side)}>
        <p {...stylex.props(styles.heading)}>{article.labels.contents}</p>
        <ContentsList beats={beats} current={beat} isCompact={false} />
      </nav>
      <div {...stylex.props(styles.main)}>
        {header}
        <details ref={detailsRef} {...stylex.props(styles.compact)}>
          <summary {...stylex.props(styles.summary)}>
            <span {...stylex.props(styles.summaryLabel)}>{article.labels.contents}</span>
            <span {...stylex.props(styles.summaryBeat)}>{currentTitle}</span>
          </summary>
          <nav aria-label={article.labels.contents}>
            <ContentsList
              beats={beats}
              current={beat}
              isCompact
              onPick={() => {
                if (detailsRef.current !== null) {
                  detailsRef.current.open = false;
                }
              }}
            />
          </nav>
        </details>
        {children}
        <ArticleNotes />
      </div>
    </div>
  );
}

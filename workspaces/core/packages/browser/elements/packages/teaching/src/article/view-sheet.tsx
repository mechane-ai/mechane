import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { LessonState } from '../lesson/define-lesson.ts';
import { Lesson } from '../lesson/lesson.tsx';
import { articleChecks } from './article-checks.ts';
import { articleLayout } from './article-layout.stylex.ts';
import { lessonBeat } from './beat.tsx';
import type { OutlineBeat } from './outline-types.ts';
import type { ViewProps } from './view-essay.tsx';

const CELL_MIN = 'minmax(min(100%, 300px), 1fr)';

const styles = stylex.create({
  root: { display: 'grid', gap: spacing.xxl, minWidth: 0, color: colors.ink, fontFamily: typography.fontFamily },
  heading: {
    margin: 0,
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
  },
  muted: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  beat: {
    display: 'grid',
    gap: spacing.md,
    paddingBlockStart: spacing.lg,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: colors.line,
  },
  beatTitle: {
    margin: 0,
    fontSize: typography.sectionSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: typography.strongWeight,
  },
  id: {
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    color: colors.muted,
    fontWeight: typography.regularWeight,
  },
  notes: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    margin: 0,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  row: { display: 'contents' },
  term: { color: colors.muted },
  value: { margin: 0 },
  cells: { display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${CELL_MIN})`, gap: spacing.lg },
  cell: {
    display: 'grid',
    alignContent: 'start',
    gap: spacing.sm,
    minWidth: 0,
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.md,
  },
  figures: { display: 'grid', gap: spacing.xl, minWidth: 0 },
  cellLabel: {
    margin: 0,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
  },
  checks: {
    display: 'grid',
    gap: spacing.xs,
    margin: 0,
    paddingInlineStart: spacing.xl,
    fontSize: typography.inputSize,
  },
  finding: { color: colors.warning },
});

const fitStyles = stylex.create({
  frame: { minWidth: 0, overflow: 'hidden' },
  design: { transformOrigin: '0 0' },
  text: { width: articleLayout.measure },
  wide: { width: `calc(${articleLayout.measure} + ${articleLayout.marginSpan})` },
  scaled: (scale: number) => ({ transform: `scale(${scale})` }),
  widened: (width: number) => ({ width }),
  reserved: (height: number) => ({ height }),
});

/** How a figure fits its cell: its scale, the height it then takes, and a design width it needed beyond the essay's. */
type Fit = { readonly scale: number; readonly height: number | undefined; readonly width: number | undefined };

const SCROLLERS: ReadonlySet<string> = new Set(['auto', 'scroll']);

/** How far the widest scrolling part of a figure runs past its own box, such as a scene wider than the text. */
function overflowOf(design: HTMLElement): number {
  const excess = [...design.querySelectorAll('*')]
    .filter((element) => SCROLLERS.has(getComputedStyle(element).overflowX))
    .map((element) => element.scrollWidth - element.clientWidth);

  return Math.max(0, ...excess);
}

/**
 * The scale that fits the figure into its frame, and the height it then takes. A figure that scrolls at the essay's
 * width is laid out wider, so the cell shows the whole of it.
 */
function fitOf({
  frame,
  design,
  fit,
}: {
  readonly frame: HTMLElement;
  readonly design: HTMLElement;
  readonly fit: Fit;
}): Fit {
  const excess = overflowOf(design);
  const width = design.offsetWidth + excess;
  const scale = Math.min(1, frame.clientWidth / width);

  return { scale, height: design.offsetHeight * scale, width: excess > 0 ? width : fit.width };
}

/**
 * Lays a figure out at the width the essay gives it, then scales it down to the cell, so the whole figure shows. It
 * measures again when the cell or the figure resizes, and when printing starts or ends.
 */
function FitWidth({ size, children }: { readonly size: 'text' | 'wide'; readonly children: ReactNode }): ReactNode {
  const frameRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit>({ scale: 1, height: undefined, width: undefined });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const design = designRef.current;

    if (frame === null || design === null) {
      return;
    }

    const observer = new ResizeObserver(() => setFit((current) => fitOf({ frame, design, fit: current })));
    const printing = new AbortController();

    observer.observe(frame);
    observer.observe(design);
    globalThis
      .matchMedia('print')
      .addEventListener('change', () => setFit((current) => fitOf({ frame, design, fit: current })), {
        signal: printing.signal,
      });

    return () => {
      observer.disconnect();
      printing.abort();
    };
  }, []);

  return (
    <div ref={frameRef} {...stylex.props(fitStyles.frame, fit.height !== undefined && fitStyles.reserved(fit.height))}>
      <div
        ref={designRef}
        {...stylex.props(
          fitStyles.design,
          fit.width === undefined ? fitStyles[size] : fitStyles.widened(fit.width),
          fitStyles.scaled(fit.scale),
        )}
      >
        {children}
      </div>
    </div>
  );
}

function TutorNotes({
  beat,
  article,
}: {
  readonly beat: OutlineBeat;
  readonly article: ViewProps['article'];
}): ReactNode {
  const declared = lessonBeat(article.lesson, beat.id);
  const { labels } = article;

  const rows = [
    { term: labels.goal, value: declared?.goal },
    { term: labels.misconception, value: declared?.misconception },
    { term: labels.tutorHints, value: declared?.hints?.join(' · ') },
    { term: labels.steps, value: String(declared?.steps ?? 0) },
  ].flatMap((row) => (row.value === undefined || row.value === '' ? [] : [{ term: row.term, value: row.value }]));

  return (
    <dl {...stylex.props(styles.notes)}>
      {rows.map((row) => (
        <div key={row.term} {...stylex.props(styles.row)}>
          <dt {...stylex.props(styles.term)}>{row.term}</dt>
          <dd {...stylex.props(styles.value)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The sheet view, for authors, reviewers and agents: every beat at each of its declared states, small and read-only,
 * with its tutor notes, then a list of checks. Each cell holds its own read-only lesson.
 */
export function SheetView({ article }: ViewProps): ReactNode {
  const findings = articleChecks(article.lesson, article.outline);
  const { labels } = article;

  return (
    <div {...stylex.props(styles.root)}>
      <div>
        <h1 {...stylex.props(styles.heading)}>{`${labels.sheet}: ${article.title}`}</h1>
      </div>
      {article.outline.beats.map((beat) => {
        const declared = lessonBeat(article.lesson, beat.id);
        const opening: LessonState = { id: 'opening', label: labels.opening, values: {} };
        const states = declared?.states === undefined || declared.states.length === 0 ? [opening] : declared.states;

        return (
          <section key={beat.id} aria-label={declared?.title ?? beat.id} {...stylex.props(styles.beat)}>
            <h2 {...stylex.props(styles.beatTitle)}>
              {declared?.title ?? beat.id} <span {...stylex.props(styles.id)}>{beat.id}</span>
            </h2>
            <TutorNotes beat={beat} article={article} />
            <div {...stylex.props(styles.cells)}>
              {states.map((state) => (
                <div key={state.id} {...stylex.props(styles.cell)}>
                  <p {...stylex.props(styles.cellLabel)}>{state.label}</p>
                  <Lesson lesson={article.lesson} locale={article.locale} values={state.values} isReadOnly>
                    <div {...stylex.props(styles.figures)}>
                      {beat.figures.map((figure) => (
                        <FitWidth key={figure.id} size={figure.size}>
                          {figure.node}
                        </FitWidth>
                      ))}
                    </div>
                  </Lesson>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <section aria-label={labels.checks} {...stylex.props(styles.beat)}>
        <h2 {...stylex.props(styles.beatTitle)}>{labels.checks}</h2>
        {findings.length === 0 ? (
          <p {...stylex.props(styles.muted)}>{labels.noProblems}</p>
        ) : (
          <ul {...stylex.props(styles.checks)}>
            {findings.map((finding) => (
              <li key={finding.message} {...stylex.props(styles.finding)}>
                {finding.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

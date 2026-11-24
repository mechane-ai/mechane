import * as stylex from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChartLink, ToneScope } from '../../../charts/src/index.ts';
import type { ChartTone } from '../../../charts/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { LessonDefinition, LessonParams, LessonValue } from '../lesson/define-lesson.ts';
import type {
  LessonChangeOrigin,
  LessonPlaceChangeDetails,
  LessonPlaceChangeReason,
  LessonValuesChangeReason,
} from '../lesson/lesson-store.ts';
import { Lesson } from '../lesson/lesson.tsx';
import type { LessonProps } from '../lesson/lesson.tsx';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { ArticleContext, createChallengeRegistry } from './article-context.ts';
import type { ArticleMath, ArticleScope, ArticleView, ChallengeRegistry } from './article-context.ts';
import { defaultArticleLabels } from './article-labels.ts';
import type { ArticleLabels } from './article-labels.ts';
import { articleLayout } from './article-layout.stylex.ts';
import { articleOutline } from './article-outline.ts';
import { beatPlace, scrollyAddedSteps } from './beat-steps.ts';
import { stateValues } from './lesson-values.ts';
import type { ArticleOutline } from './outline-types.ts';
import { useProgressRoot } from './progress-store.ts';
import type { LessonProgress, ProgressApi, ProgressChangeDetails } from './progress-store.ts';
import { EssayView } from './view-essay.tsx';
import type { ViewProps } from './view-essay.tsx';
import { PresentView } from './view-present.tsx';
import { SheetView } from './view-sheet.tsx';
import { StaticView } from './view-static.tsx';

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    containerName: 'article',
    display: 'block',
    minWidth: 0,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
  },
  header: {
    display: 'grid',
    gap: spacing.md,
    maxWidth: articleLayout.measure,
    marginBlockEnd: spacing.xxl,
    paddingBlockEnd: spacing.xl,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  title: {
    margin: 0,
    fontSize: { default: typography.compactHeadingSize, [articleLayout.withMargin]: typography.headingSize },
    lineHeight: {
      default: typography.compactHeadingLineHeight,
      [articleLayout.withMargin]: typography.headingLineHeight,
    },
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
    textWrap: 'balance',
  },
  summary: { margin: 0, color: colors.muted, fontSize: typography.sectionSize, lineHeight: typography.proseLineHeight },
  byline: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
});

/** The views a reader reads in, where the beat they open on counts as visited. */
const readingViews: ReadonlySet<ArticleView> = new Set(['article', 'present']);

const views: Readonly<Record<ArticleView, (props: ViewProps) => ReactNode>> = {
  article: EssayView,
  present: PresentView,
  static: StaticView,
  sheet: SheetView,
};

export type ArticleProps<Params extends LessonParams, Derived extends string, Beat extends string> = {
  readonly lesson: LessonDefinition<Params, Derived, Beat>;
  /** The locale every value, date and figure of the article is written in. */
  readonly locale: string;
  readonly title: string;
  readonly authors?: ReadonlyArray<string> | undefined;
  /** The publication date as an ISO date, such as `2026-11-23`. */
  readonly date?: string | undefined;
  /** A sentence or two under the title that says what the reader will learn. */
  readonly summary?: ReactNode;
  /** The lesson's color meaning, declared once: the tone of each id every figure and term of the article shares. */
  readonly tones?: Readonly<Record<string, ChartTone>> | undefined;
  /** How the same children are arranged. Defaults to `article`, the scrolling essay. */
  readonly view?: ArticleView | undefined;
  /** Typesets the source of each `TeX`. Without it, math shows its TeX source. */
  readonly math?: ArticleMath | undefined;
  /** Keeps the lesson's values and the reader's progress in local storage under this key. */
  readonly storageKey?: string | undefined;
  /** The reader's progress, when the application holds it. */
  readonly progress?: LessonProgress | undefined;
  readonly defaultProgress?: LessonProgress | undefined;
  /** Hears each change of the reader's progress. A change an agent makes is refused before it gets here. */
  readonly onProgressChange?: ((progress: LessonProgress, details: ProgressChangeDetails) => void) | undefined;
  readonly labels?: Partial<ArticleLabels> | undefined;
  /**
   * Whether the article and static views show their contents list. Set it to false when the host's own navigation lists
   * the beats, such as a rail that sets the beat through `lessonProps`. The text column keeps its measure.
   */
  readonly hasContents?: boolean | undefined;
  /** Passed to the `Lesson` the article renders: controlled values, beat and step, or address bar sync. */
  readonly lessonProps?:
    | Omit<LessonProps<Params, Derived, Beat>, 'lesson' | 'locale' | 'storageKey' | 'children'>
    | undefined;
  /** The essay: `Beat`s, and around them `References` and anything else. */
  readonly children: ReactNode;
};

/** The origin of the presenter's last move to a beat or a step, waiting for the slide to show it. */
type PresenterMoves = {
  readonly wait: (origin: LessonChangeOrigin) => void;
  readonly pending: () => LessonChangeOrigin | null;
  readonly clear: () => void;
};

function createPresenterMoves(): PresenterMoves {
  const memory: { pending: LessonChangeOrigin | null } = { pending: null };

  return {
    wait: (origin) => {
      memory.pending = origin;
    },
    pending: () => memory.pending,
    clear: () => {
      memory.pending = null;
    },
  };
}

/** The values reason a presenter's move reports when it shows the values of the beat or step it moved to. */
const moveReasons: ReadonlyMap<LessonPlaceChangeReason, LessonValuesChangeReason> = new Map<
  LessonPlaceChangeReason,
  LessonValuesChangeReason
>([
  ['press', 'press'],
  ['link-press', 'press'],
  ['scroll', 'scroll'],
  ['shortcut', 'shortcut'],
]);

function moveOrigin(details: LessonPlaceChangeDetails): LessonChangeOrigin {
  return { reason: moveReasons.get(details.reason) ?? 'imperative', event: details.event, source: details.source };
}

/** What the slide showed last: its beat and its scrolly step. */
type Shown = { beat: string | null; scrolly: number | null };

/**
 * Keeps the challenges' view of the values current and records the beat the reader opens on. In the present view it
 * shows the values of each beat and scrolly step the presenter moves to, in one change with the move's origin.
 */
function ArticleWatch({
  challenges,
  progressApi,
  isReading,
  moves,
  outline,
  opening,
}: {
  readonly challenges: ChallengeRegistry;
  readonly progressApi: ProgressApi;
  readonly isReading: boolean;
  readonly moves: PresenterMoves;
  readonly outline: ArticleOutline;
  readonly opening: Readonly<Record<string, LessonValue>>;
}): ReactNode {
  const { values, beat, step, lesson, show, setMany } = useLessonContext();
  const first = useRef(beat);
  const outlined = outline.beats.find((item) => item.id === beat);
  const place = beatPlace({ beat: outlined, step, view: 'present' });
  const shown = useRef<Shown>({ beat, scrolly: place.scrolly });

  useEffect(() => {
    challenges.remember(values);
  });

  useEffect(() => {
    if (isReading && first.current !== null) {
      progressApi.visit(first.current, { reason: 'visit' });
    }
  }, [isReading, progressApi]);

  useEffect(() => {
    const origin = moves.pending();

    if (origin === null) {
      return;
    }

    const isOtherBeat = shown.current.beat !== beat;
    const scrollyStep = place.scrolly === null ? undefined : outlined?.scrollySteps[place.scrolly];
    const isOtherStep = scrollyStep !== undefined && (isOtherBeat || shown.current.scrolly !== place.scrolly);
    const state = lesson.beats.find((item) => item.id === beat)?.states?.[0];

    shown.current = { beat, scrolly: place.scrolly };

    if (isOtherStep) {
      const stepValues = scrollyStep.state === undefined ? scrollyStep.values : stateValues(lesson, scrollyStep.state);

      setMany({ ...opening, ...state?.values, ...stepValues }, origin);
    } else if (isOtherBeat && state !== undefined) {
      show(state.id, origin);
    }

    moves.clear();
  }, [beat, lesson, moves, opening, outlined, place.scrolly, setMany, show]);

  return null;
}

function formattedDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * An explorable essay on one lesson: a title block, beats of prose and figures, and the exercises, notes and references
 * around them. It renders the `Lesson`, the tone scope and one link scope, and arranges the same children in four
 * views. The reader's progress is the UI SDK primitive `lesson-progress`, which counts only what the reader did.
 */
export function Article<Params extends LessonParams, Derived extends string, Beat extends string>({
  lesson,
  locale,
  title,
  authors = [],
  date,
  summary,
  tones = {},
  view = 'article',
  math,
  storageKey,
  progress,
  defaultProgress,
  onProgressChange,
  labels,
  hasContents = true,
  lessonProps,
  children,
}: ArticleProps<Params, Derived, Beat>): ReactNode {
  const titleId = useId();
  const [moves] = useState(createPresenterMoves);
  const outline = articleOutline(children);
  const isPresent = view === 'present';
  const [challenges] = useState(() => createChallengeRegistry(lesson.initial));
  const words = { ...defaultArticleLabels, ...labels };

  const byline = [
    authors.length > 0 ? `${words.by} ${authors.join(', ')}` : '',
    date === undefined ? '' : formattedDate(date, locale),
  ]
    .filter((part) => part !== '')
    .join(' · ');

  const header = (
    <header {...stylex.props(styles.header)}>
      <h1 id={titleId} {...stylex.props(styles.title)}>
        {title}
      </h1>
      {summary === undefined ? null : <p {...stylex.props(styles.summary)}>{summary}</p>}
      {byline === '' ? null : <p {...stylex.props(styles.byline)}>{byline}</p>}
    </header>
  );

  const View = views[view];

  return useProgressRoot(
    {
      progress,
      defaultProgress,
      onProgressChange,
      storageKey: storageKey === undefined ? undefined : `${storageKey}.progress`,
    },
    (current, api) => {
      const scope: ArticleScope = {
        view,
        title,
        hasContents,
        lesson,
        locale,
        labels: words,
        math,
        outline,
        progress: current,
        progressApi: api,
        challenges,
      };

      return {
        'aria-labelledby': view === 'sheet' ? undefined : titleId,
        'aria-label': view === 'sheet' ? title : undefined,
        'children': (
          <Lesson
            {...lessonProps}
            lesson={lesson}
            locale={locale}
            storageKey={storageKey}
            onValuesChange={(values, details) => {
              lessonProps?.onValuesChange?.(values, details);

              const isOpening = moves.pending() !== null;
              const isReader = details.source !== 'agent' && details.reason !== 'restore';

              if (details.canceled || !isReader || isOpening) {
                return;
              }

              const before = challenges.seen();
              const after = { ...values, ...lesson.compute(values) };

              for (const [id, isReached] of challenges.entries()) {
                if (!isReached(before) && isReached(after)) {
                  api.reach(id, { reason: 'reach', event: details.event });
                }
              }
            }}
            onBeatChange={(next, details) => {
              lessonProps?.onBeatChange?.(next, details);

              if (details.canceled || next === null) {
                return;
              }

              api.visit(next, { reason: 'visit', event: details.event, source: details.source });

              if (isPresent && details.reason !== 'restore') {
                moves.wait(moveOrigin(details));
              }
            }}
            onStepChange={(next, details) => {
              lessonProps?.onStepChange?.(next, details);

              if (!details.canceled && isPresent && details.reason !== 'restore') {
                moves.wait(moveOrigin(details));
              }
            }}
            addedSteps={isPresent ? scrollyAddedSteps(outline) : undefined}
          >
            <ToneScope ids={Object.keys(tones)} tones={tones}>
              <ChartLink>
                <ArticleContext value={scope}>
                  <ArticleWatch
                    challenges={challenges}
                    progressApi={api}
                    isReading={readingViews.has(view)}
                    moves={moves}
                    outline={outline}
                    opening={{ ...lesson.defaults, ...lessonProps?.defaultValues }}
                  />
                  <View article={scope} header={header}>
                    {children}
                  </View>
                </ArticleContext>
              </ChartLink>
            </ToneScope>
          </Lesson>
        ),
        ...stylex.props(styles.root),
      };
    },
  );
}

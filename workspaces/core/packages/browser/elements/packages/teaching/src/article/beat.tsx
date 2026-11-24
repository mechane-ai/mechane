import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { AnyLesson, LessonBeat, LessonValue } from '../lesson/define-lesson.ts';
import { LessonError } from '../lesson/lesson-error.tsx';
import { Lesson } from '../lesson/lesson.tsx';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { BeatContext, useArticle } from './article-context.ts';
import { BlockError, outsideText, unlistedText } from './article-error.tsx';
import { articleLayout } from './article-layout.stylex.ts';
import { beatPlace } from './beat-steps.ts';
import { ArticleNotes } from './notes.tsx';

const styles = stylex.create({
  hidden: { display: 'none' },
  beat: {
    display: 'block',
    minWidth: 0,
    maxWidth: {
      default: articleLayout.measure,
      [articleLayout.withMargin]: `calc(${articleLayout.measure} + ${articleLayout.marginSpan})`,
    },
    paddingInlineEnd: { default: 0, [articleLayout.withMargin]: articleLayout.marginSpan },
    marginBlockEnd: spacing.xxl,
    scrollMarginBlockStart: spacing.xl,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
    overflowWrap: 'break-word',
  },
  title: {
    marginBlockStart: 0,
    marginBlockEnd: spacing.md,
    fontSize: typography.compactHeadingSize,
    lineHeight: typography.compactHeadingLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
    textWrap: 'balance',
    breakAfter: 'avoid',
  },
});

export type BeatProps = {
  /** The id of a beat the lesson declares. Its title, tutor notes, reveal steps and states come from there. */
  readonly id: string;
  /** The beat's prose, figures and exercises. */
  readonly children: ReactNode;
};

/** The values a beat opens with: its first declared state over the lesson's defaults. */
function openingValues(beat: LessonBeat | undefined): Readonly<Record<string, LessonValue>> {
  return beat?.states?.[0]?.values ?? {};
}

/** The beat a lesson declares under `id`, or undefined. */
export function lessonBeat(lesson: AnyLesson, id: string): LessonBeat | undefined {
  return lesson.beats.find((item) => item.id === id);
}

/**
 * One beat of an essay: a titled section whose title, tutor notes, reveal steps and states the lesson declares. The
 * article view scrolls through every beat, the present view shows the current one, and the static view opens each at
 * its first state. Tutor notes are never shown to the reader.
 */
export function Beat({ id, children }: BeatProps): ReactNode {
  const article = useArticle();
  const { beat, step } = useLessonContext();
  const headingId = useId();

  if (article === null) {
    return <BlockError>{outsideText('Beat')}</BlockError>;
  }

  const declared = lessonBeat(article.lesson, id);
  const isCurrent = beat === id;
  const outlined = article.outline.beats.find((item) => item.id === id);
  const place = beatPlace({ beat: outlined, step: isCurrent ? step : 0, view: article.view });
  const isStatic = article.view === 'static';
  const isHidden = article.view === 'present' && !isCurrent;

  const title =
    declared === undefined ? (
      <LessonError>{`Lesson "${article.lesson.id}" has no beat "${id}". Its beats: ${article.lesson.beats.map((item) => item.id).join(', ')}.`}</LessonError>
    ) : (
      declared.title
    );

  const content = (
    <BeatContext value={{ id, isCurrent, step: place.reveal, scrolly: place.scrolly }}>
      <h2 id={headingId} {...stylex.props(styles.title)}>
        {title}
      </h2>
      {outlined === undefined ? <BlockError>{unlistedText('Beat', id)}</BlockError> : null}
      {children}
      {article.view === 'present' ? <ArticleNotes beat={id} /> : null}
    </BeatContext>
  );

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-beat={id}
      data-current={isCurrent ? '' : undefined}
      hidden={isHidden}
      {...stylex.props(styles.beat, isHidden && styles.hidden)}
    >
      {isStatic ? (
        <Lesson lesson={article.lesson} locale={article.locale} values={openingValues(declared)} isReadOnly>
          {content}
        </Lesson>
      ) : (
        content
      )}
    </section>
  );
}

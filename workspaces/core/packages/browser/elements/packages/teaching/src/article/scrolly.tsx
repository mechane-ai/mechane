import * as stylex from '@stylexjs/stylex';
import { isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { colors, spacing } from '../../../foundations/src/tokens.stylex.ts';
import type { AnyLesson, LessonValue } from '../lesson/define-lesson.ts';
import { Lesson } from '../lesson/lesson.tsx';
import { useLessonContext } from '../lesson/use-lesson.ts';
import { useArticle, useBeat } from './article-context.ts';
import type { ArticleView } from './article-context.ts';
import { BlockError, outsideText } from './article-error.tsx';
import { articleLayout, articleSticky } from './article-layout.stylex.ts';
import { FigureColumn, FigureCopy } from './figure.tsx';
import { stateValues, valuesProblem } from './lesson-values.ts';
import { walkMarkup } from './walk.ts';

const WIDE = '@container scrolly (min-width: 640px)';

/** The views that print each step with its figure at its values. */
const printedViews: ReadonlySet<ArticleView> = new Set(['static', 'sheet']);

const styles = stylex.create({
  root: {
    containerType: 'inline-size',
    containerName: 'scrolly',
    clear: 'both',
    marginBlock: spacing.xl,
    marginInlineEnd: { default: 0, [articleLayout.withMargin]: `calc(-1 * ${articleLayout.marginSpan})` },
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr)', [WIDE]: 'minmax(0, 2fr) minmax(0, 3fr)' },
    columnGap: spacing.xl,
    alignItems: 'start',
  },
  figure: {
    position: 'sticky',
    insetBlockStart: articleSticky.top,
    zIndex: 1,
    gridRow: { default: 1, [WIDE]: 1 },
    gridColumn: { default: 1, [WIDE]: 2 },
    paddingBlock: spacing.sm,
    backgroundColor: colors.surface,
  },
  steps: { gridRow: { default: 2, [WIDE]: 1 }, gridColumn: 1, display: 'grid', gap: 0, minWidth: 0 },
  step: { display: 'flex', alignItems: 'center', minHeight: { default: '55vh', [WIDE]: '70vh' }, color: colors.ink },
  firstStep: { minHeight: { default: '40vh', [WIDE]: '50vh' } },
  away: { color: colors.faint },
  stepText: { maxWidth: articleLayout.measure },
  sequence: { display: 'grid', gap: spacing.lg },
  slideLayout: {
    display: 'grid',
    gridTemplateColumns: { default: 'minmax(0, 1fr)', [WIDE]: 'minmax(0, 2fr) minmax(0, 3fr)' },
    gap: spacing.lg,
    alignItems: 'start',
  },
  slideFigure: { gridRow: 1, gridColumn: { default: 1, [WIDE]: 2 } },
  slideSteps: {
    display: 'grid',
    gap: spacing.sm,
    gridRow: { default: 2, [WIDE]: 1 },
    gridColumn: 1,
    minWidth: 0,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  slideStep: {
    paddingInlineStart: spacing.md,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    color: colors.faint,
  },
  current: { borderInlineStartColor: colors.ink, color: colors.ink },
});

export type ScrollyStepProps = {
  /** The step's id, unique in its scrolly. */
  readonly id: string;
  /** The values this step applies while it is in view. */
  readonly values?: Readonly<Record<string, LessonValue>> | undefined;
  /** A state of a lesson beat this step shows while it is in view, by its id. */
  readonly state?: string | undefined;
  /** The step's prose. */
  readonly children: ReactNode;
};

/** One step of a `Scrolly`: prose that sets the lesson's values while the reader has it in view. */
export function ScrollyStep({ children }: ScrollyStepProps): ReactNode {
  return children;
}

export type ScrollyProps = {
  /** The figure that stays in view beside the steps and follows the values each step applies. */
  readonly figure: ReactNode;
  /** The steps, as `ScrollyStep` elements. */
  readonly children: ReactNode;
};

type Step = {
  readonly id: string;
  readonly values: Readonly<Record<string, LessonValue>>;
  readonly content: ReactNode;
};

/** The steps written in a scrolly, with the values each applies, or the first problem with them. */
function stepsOf(
  children: ReactNode,
  lesson: AnyLesson,
): { readonly steps: ReadonlyArray<Step> } | { readonly error: string } {
  const entries = [
    ...walkMarkup({ node: children, place: { beat: null, figure: null }, placeOf: ({ place }) => place }),
  ];

  const steps = entries.flatMap(({ element }) =>
    element.type === ScrollyStep && isValidElement<ScrollyStepProps>(element) ? [element.props] : [],
  );

  const unknown = steps.find((step) => step.state !== undefined && stateValues(lesson, step.state) === undefined);

  if (unknown !== undefined) {
    return { error: `ScrollyStep "${unknown.id}" shows state "${unknown.state ?? ''}", which no beat declares.` };
  }

  const resolved = steps.map((step) => ({
    id: step.id,
    values: (step.state === undefined ? undefined : stateValues(lesson, step.state)) ?? step.values ?? {},
    content: step.children,
  }));

  const problem = resolved.map((step) => valuesProblem(lesson, step.values)).find((text) => text !== undefined);

  return problem === undefined ? { steps: resolved } : { error: problem };
}

/**
 * A figure that stays in view while the reader scrolls through steps of prose beside it, each setting the lesson's
 * values. The present view lists the steps beside the figure and walks them as the beat's first steps. The static view
 * prints each step with the figure at its values.
 */
export function Scrolly({ figure, children }: ScrollyProps): ReactNode {
  const article = useArticle();
  const { setMany } = useLessonContext();
  const [active, setActive] = useState<string | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const found = article === null ? { error: outsideText('Scrolly') } : stepsOf(children, article.lesson);
  const steps = 'steps' in found ? found.steps : [];
  const problem = 'error' in found ? found.error : undefined;
  const isLive = article?.view === 'article';
  const beat = useBeat();
  const latest = useRef({ steps, setMany, applied: '' });
  const stepKey = steps.map((step) => step.id).join('\n');

  useEffect(() => {
    latest.current.steps = steps;
    latest.current.setMany = setMany;
  });

  useEffect(() => {
    const root = stepsRef.current;

    if (root === null || !isLive) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries.find((entry) => entry.isIntersecting)?.target;
        const shown = target instanceof HTMLElement ? target.dataset['step'] : undefined;
        const step = latest.current.steps.find((item) => item.id === shown);

        if (step !== undefined && step.id !== latest.current.applied) {
          latest.current.applied = step.id;

          setActive(step.id);
          latest.current.setMany(step.values, { reason: 'scroll' });
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );

    for (const element of root.querySelectorAll('[data-step]')) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [isLive, stepKey]);

  if (article === null || problem !== undefined) {
    return <BlockError>{problem ?? outsideText('Scrolly')}</BlockError>;
  }

  if (article.view === 'present') {
    const outlined = article.outline.beats.find((item) => item.id === beat?.id);
    const offset = outlined?.scrollySteps.findIndex((item) => item.id === steps[0]?.id) ?? 0;
    const index = Math.min((beat?.scrolly ?? 0) - offset, steps.length - 1);
    const current = index < 0 ? undefined : steps[index]?.id;

    return (
      <div {...stylex.props(styles.root)}>
        <div {...stylex.props(styles.slideLayout)}>
          <div {...stylex.props(styles.slideFigure)}>
            <FigureColumn value>{figure}</FigureColumn>
          </div>
          <ol {...stylex.props(styles.slideSteps)}>
            {steps.map((step) => (
              <li
                key={step.id}
                data-step={step.id}
                data-active={current === step.id ? '' : undefined}
                aria-current={current === step.id ? 'step' : undefined}
                {...stylex.props(styles.slideStep, current === step.id && styles.current)}
              >
                {step.content}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (printedViews.has(article.view)) {
    return (
      <div {...stylex.props(styles.root, styles.sequence)}>
        {steps.map((step, position) => (
          <div key={step.id} {...stylex.props(styles.sequence)}>
            <div {...stylex.props(styles.stepText)}>{step.content}</div>
            <Lesson lesson={article.lesson} locale={article.locale} values={step.values} isReadOnly>
              <FigureCopy value={position > 0}>
                <FigureColumn value>{figure}</FigureColumn>
              </FigureCopy>
            </Lesson>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.layout)}>
        <div {...stylex.props(styles.figure)}>
          <FigureColumn value>{figure}</FigureColumn>
        </div>
        <div ref={stepsRef} {...stylex.props(styles.steps)}>
          {steps.map((step, position) => (
            <div
              key={step.id}
              data-step={step.id}
              data-active={active === step.id ? '' : undefined}
              {...stylex.props(
                styles.step,
                position === 0 && styles.firstStep,
                active !== null && active !== step.id && styles.away,
              )}
            >
              <div {...stylex.props(styles.stepText)}>{step.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

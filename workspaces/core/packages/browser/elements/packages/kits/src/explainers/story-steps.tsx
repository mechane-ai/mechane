import * as stylex from '@stylexjs/stylex';
import { dispatch } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import type { SegmentedControlValueChangeReason } from '@ui-sdk/core/segmented-control';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { ChartLink, useChartLinkControl } from '../../../charts/src/index.ts';
import type { ChartLinkInspectChange } from '../../../charts/src/index.ts';
import { Button } from '../../../core/src/index.ts';
import { SegmentedControl } from '../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';

const STEPS_MIN_WIDTH = 240;
const FIGURES_MIN_WIDTH = 360;

/** One observation in a walk through the figures. */
export type StoryStep = {
  readonly id: string;
  readonly title: string;
  /** The explanation: a few sentences, which may hold `Term`s and `FigureReference`s. */
  readonly body: ReactNode;
  /**
   * The record this step talks about, which every linked figure inspects while the step is shown. The reader can still
   * inspect freely, and the next step points the figures again.
   */
  readonly inspected?: string | null | undefined;
};

/** Why the step changed: Back or Next, a press on a step's number, or an arrow key on the numbers. */
export type StoryStepChangeDetails = ChangeDetails<SegmentedControlValueChangeReason | 'previous-press' | 'next-press'>;

/** The words of the step controls. The position reads "Step 2 of 5": `step`, the number, `of`, the count. */
export type StoryStepsLabels = {
  readonly back: string;
  readonly next: string;
  readonly step: string;
  readonly of: string;
};

export type StoryStepsProps = {
  /**
   * Back, Next and the step numbers move between steps, and the arrow keys move along the numbers. Nothing advances on
   * its own.
   */
  readonly steps: ReadonlyArray<StoryStep>;
  /** The id of the step shown, when the application holds it. */
  readonly step?: string | undefined;
  readonly defaultStep?: string | undefined;
  readonly onStepChange?: ((step: string, details: StoryStepChangeDetails) => void) | undefined;
  /** Names the walk for assistive technology, such as "How the runs differ". */
  readonly label?: string | undefined;
  readonly labels?: Partial<StoryStepsLabels> | undefined;
  /** The figures the steps talk about. They share one inspection with the steps. */
  readonly children: ReactNode;
};

const defaultLabels: StoryStepsLabels = { back: 'Back', next: 'Next', step: 'Step', of: 'of' };

const styles = stylex.create({
  root: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.xl, minWidth: 0 },
  steps: {
    display: 'grid',
    gap: spacing.md,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: STEPS_MIN_WIDTH,
    minWidth: 0,
    fontFamily: typography.fontFamily,
    color: colors.ink,
  },
  figures: { display: 'grid', gap: spacing.xl, flexGrow: 2, flexShrink: 1, flexBasis: FIGURES_MIN_WIDTH, minWidth: 0 },
  position: {
    margin: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  current: { display: 'grid', gap: spacing.sm, minWidth: 0 },
  title: {
    margin: 0,
    fontSize: typography.sectionSize,
    lineHeight: typography.sectionLineHeight,
    fontWeight: typography.strongWeight,
  },
  body: { margin: 0, fontSize: typography.inputSize, lineHeight: typography.proseLineHeight, overflowWrap: 'anywhere' },
  controls: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  error: { margin: 0, color: colors.danger, fontFamily: typography.fontFamily, fontSize: typography.bodySize },
});

function stepsError(steps: ReadonlyArray<StoryStep>, step: string | undefined): string | undefined {
  if (steps.length === 0) {
    return 'StorySteps needs at least one step.';
  }

  if (new Set(steps.map((item) => item.id)).size !== steps.length) {
    return 'Every step needs its own id.';
  }

  if (step !== undefined && !steps.some((item) => item.id === step)) {
    return `Unknown step "${step}".`;
  }

  return undefined;
}

/**
 * An explanation told in steps beside its figures, like a guided reading of a chart, where each step points every
 * linked figure at the record it talks about. Inside an enclosing `ChartLink`, such as one around a whole article, it
 * points that link on each move instead of keeping its own. Terms anywhere on the page then reach the same figures.
 */
export function StorySteps({
  steps,
  step,
  defaultStep,
  onStepChange,
  label = 'Steps',
  labels,
  children,
}: StoryStepsProps): ReactNode {
  const words = { ...defaultLabels, ...labels };
  const [ownStep, setOwnStep] = useState(defaultStep ?? steps[0]?.id);
  const shownId = step ?? ownStep;
  const index = steps.findIndex((item) => item.id === shownId);
  const current = steps[index];
  const outer = useChartLinkControl();
  const [inspected, setInspected] = useState(current?.inspected ?? null);
  const [appliedStep, setAppliedStep] = useState(current?.id);
  const currentId = useId();

  if (outer === undefined && current !== undefined && current.id !== appliedStep) {
    setAppliedStep(current.id);
    setInspected(current.inspected ?? null);
  }

  const error = stepsError(steps, shownId);

  if (error !== undefined || current === undefined) {
    return <p {...stylex.props(styles.error)}>{error ?? 'StorySteps has no step to show.'}</p>;
  }

  const previous = steps[index - 1];
  const next = steps[index + 1];

  function show(target: StoryStep, change: ChartLinkInspectChange): void {
    setOwnStep(target.id);
    outer?.inspect(target.inspected ?? null, change);
  }

  function press(target: StoryStep | undefined, reason: 'previous-press' | 'next-press', event: MouseEvent): void {
    if (target === undefined) {
      return;
    }

    const isCanceled = dispatch({ options: () => ({ onStepChange }) }, 'onStepChange', target.id, { reason, event });

    if (!isCanceled) {
      show(target, { reason: 'item-press', event });
    }
  }

  const place = `${words.step} ${index + 1} ${words.of} ${steps.length}`;

  const walk = (
    <div {...stylex.props(styles.root)}>
      <section aria-label={label} {...stylex.props(styles.steps)}>
        <p {...stylex.props(styles.position)}>{place}</p>
        <div id={currentId} aria-live="polite" {...stylex.props(styles.current)}>
          <p {...stylex.props(styles.title)}>{current.title}</p>
          <div {...stylex.props(styles.body)}>{current.body}</div>
        </div>
        <div {...stylex.props(styles.controls)}>
          <Button
            density="compact"
            disabled={previous === undefined}
            focusableWhenDisabled
            aria-controls={currentId}
            onClick={(event) => press(previous, 'previous-press', event.nativeEvent)}
          >
            {words.back}
          </Button>
          <SegmentedControl.Root
            value={current.id}
            aria-label={`${label}: ${place}`}
            onValueChange={(value, details) => {
              const target = steps.find((item) => item.id === value);

              onStepChange?.(value, details);

              if (target !== undefined && !details.canceled) {
                show(target, {
                  reason: details.reason === 'list-navigation' ? 'list-navigation' : 'item-press',
                  event: details.event,
                });
              }
            }}
          >
            {steps.map((item, position) => (
              <SegmentedControl.Item key={item.id} value={item.id} aria-label={`${position + 1}. ${item.title}`}>
                {position + 1}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <Button
            density="compact"
            disabled={next === undefined}
            focusableWhenDisabled
            aria-controls={currentId}
            onClick={(event) => press(next, 'next-press', event.nativeEvent)}
          >
            {words.next}
          </Button>
        </div>
      </section>
      <div {...stylex.props(styles.figures)}>{children}</div>
    </div>
  );

  if (outer !== undefined) {
    return walk;
  }

  return (
    <ChartLink
      inspected={inspected}
      onInspectedChange={(id, details) => {
        if (!details.canceled) {
          setInspected(id);
        }
      }}
    >
      {walk}
    </ChartLink>
  );
}

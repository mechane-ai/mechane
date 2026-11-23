import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { FigureProps, ValueFormat } from '../../../charts/src/index.ts';
import { TokenPredictions } from '../../../charts/src/text/index.ts';
import type { TokenPrediction } from '../../../charts/src/text/index.ts';
import { Button, Row } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { Slider } from '../../../forms/src/index.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { repeatedFeatureId } from './features.ts';
import type { InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';

/** A feature the reader can steer with, and the range its strength may take. */
export type SteeringFeature = {
  readonly id: string;
  readonly label: string;
  /** What steering with it should do: "Pulls the text toward the bridge". */
  readonly description?: string | undefined;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The strength that leaves the model unchanged. Absent means 0. Reset returns every slider here. */
  readonly neutral?: number | undefined;
};

/** The model's text continuation before and after steering, as the application generated them. */
export type SteeringCompletions = { readonly baseline: string; readonly steered: string };

/** The words in the panel. Each has an English default. */
export type SteeringPanelLabels = {
  readonly controls: string;
  readonly reset: string;
  readonly prompt: string;
  readonly predictions: string;
  readonly predictionsDescription: string;
  readonly baseline: string;
  readonly steered: string;
};

export type SteeringPanelProps = Pick<FigureProps, 'title' | 'locale' | 'status' | 'source'> & {
  readonly features: ReadonlyArray<SteeringFeature>;
  /** The strength of each feature, keyed by feature id. A feature without a value sits at its neutral strength. */
  readonly values: Readonly<Record<string, number>>;
  readonly onValuesChange?:
    | ((values: Readonly<Record<string, number>>, details: InterpretabilityChangeDetails) => void)
    | undefined;
  /** How a strength is written beside its slider. */
  readonly strengthFormat?: ValueFormat | undefined;
  /** The prompt the outputs continue. */
  readonly prompt?: string | undefined;
  /** The next-token predictions with steering, each with its probability before steering as `baseline`. */
  readonly predictions: ReadonlyArray<TokenPrediction>;
  readonly completions?: SteeringCompletions | undefined;
  readonly labels?: Partial<SteeringPanelLabels> | undefined;
};

const strengthDefault = { maximumFractionDigits: 1, signDisplay: 'exceptZero' } as const;

const defaultLabels: SteeringPanelLabels = {
  controls: 'Feature strengths',
  reset: 'Reset',
  prompt: 'Prompt',
  predictions: 'Next token',
  predictionsDescription: 'Bars are with steering; ticks are the same tokens before steering.',
  baseline: 'Before steering',
  steered: 'With steering',
};

const styles = stylex.create({
  controls: {
    display: 'grid',
    gap: spacing.lg,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '260px',
    minWidth: 0,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
  },
  slider: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  completions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
    gap: spacing.lg,
    minWidth: 0,
  },
  text: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.proseLineHeight,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  steered: { paddingInlineStart: spacing.sm, borderInlineStartWidth: 2, borderInlineStartStyle: 'solid' },
  steeredLine: { borderInlineStartColor: colors.focus },
  baselineLine: { borderInlineStartColor: colors.line },
});

/**
 * Steering, as feature-steering demos show it: a slider per feature strength beside what the model does with that
 * setting. It shows next-token predictions with ticks for the same tokens before steering and, when supplied, the text
 * it continues with before and after. The kit never runs a model: the application holds the strengths, hears each
 * change, and supplies the outputs for the current setting.
 */
export function SteeringPanel({
  title,
  locale,
  status,
  source,
  features,
  values,
  onValuesChange,
  strengthFormat = strengthDefault,
  prompt,
  predictions,
  completions,
  labels: given,
}: SteeringPanelProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const repeated = repeatedFeatureId(features.map((feature) => feature.id));
  const invalid = features.find((feature) => !(feature.min < feature.max && feature.step > 0));
  const stray = Object.keys(values).find((id) => !features.some((feature) => feature.id === id));

  const problem =
    (repeated === undefined ? undefined : `Feature ${repeated} appears twice.`) ??
    (invalid === undefined
      ? undefined
      : `Feature ${invalid.id} needs a minimum below its maximum and a step above 0.`) ??
    (stray === undefined ? undefined : `A strength is given for ${stray}, which is not among the features.`);

  if (problem !== undefined) {
    return <Notice hasError>{`${title}: ${problem}`}</Notice>;
  }

  const neutral = Object.fromEntries(features.map((feature) => [feature.id, feature.neutral ?? 0]));
  const current = { ...neutral, ...values };

  return (
    <section aria-label={title} {...stylex.props(kitStyles.stack)}>
      <h3 {...stylex.props(kitStyles.title)}>{title}</h3>
      <div {...stylex.props(kitStyles.split)}>
        <div {...stylex.props(styles.controls)}>
          <Row shouldSpaceBetween>
            <p {...stylex.props(kitStyles.label)}>{labels.controls}</p>
            <Button
              variant="ghost"
              density="compact"
              onClick={(event) => onValuesChange?.(neutral, { reason: 'press', event: event.nativeEvent })}
            >
              {labels.reset}
            </Button>
          </Row>
          {features.map((feature) => (
            <Slider.Root
              key={feature.id}
              locale={locale}
              format={strengthFormat}
              min={feature.min}
              max={feature.max}
              step={feature.step}
              value={current[feature.id] ?? 0}
              onValueChange={(value, details) =>
                onValuesChange?.({ ...current, [feature.id]: value }, { reason: 'input', event: details.event })
              }
            >
              <div {...stylex.props(styles.slider)}>
                <Row shouldSpaceBetween>
                  <Slider.Label>{feature.label}</Slider.Label>
                  <Slider.Value />
                </Row>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Indicator />
                  </Slider.Track>
                  <Slider.Thumb />
                </Slider.Control>
                {feature.description !== undefined && <p {...stylex.props(kitStyles.muted)}>{feature.description}</p>}
              </div>
            </Slider.Root>
          ))}
        </div>
        <div {...stylex.props(kitStyles.main, kitStyles.stack)}>
          {prompt !== undefined && (
            <div {...stylex.props(kitStyles.tight)}>
              <p {...stylex.props(kitStyles.label)}>{labels.prompt}</p>
              <p {...stylex.props(styles.text)}>{prompt}</p>
            </div>
          )}
          <TokenPredictions
            title={labels.predictions}
            description={labels.predictionsDescription}
            locale={locale}
            status={status}
            source={source}
            predictions={predictions}
            baselineLabel={labels.baseline}
          />
          {completions !== undefined && (
            <div {...stylex.props(styles.completions)}>
              {[
                { id: 'baseline', label: labels.baseline, text: completions.baseline, line: styles.baselineLine },
                { id: 'steered', label: labels.steered, text: completions.steered, line: styles.steeredLine },
              ].map((entry) => (
                <div key={entry.id} {...stylex.props(kitStyles.tight, styles.steered, entry.line)}>
                  <p {...stylex.props(kitStyles.label)}>{entry.label}</p>
                  <p {...stylex.props(styles.text)}>{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

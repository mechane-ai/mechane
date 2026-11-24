import * as stylex from '@stylexjs/stylex';
import { fractionOf, scrubTo, stepValue, valueAt } from '@ui-sdk/core/number';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { formatValue } from '../../../charts/src/index.ts';
import { Row } from '../../../core/src/index.ts';
import { Field, SegmentedControl, Slider, Switch } from '../../../forms/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { LessonParam } from './define-lesson.ts';
import { useLessonScope } from './lesson-context.ts';
import { LessonError } from './lesson-error.tsx';
import { lessonParam } from './param.tsx';

/** How many positions a log slider has from its min to its max. */
const LOG_POSITIONS = 1000;

const styles = stylex.create({
  control: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  label: {
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.mediumWeight,
  },
  segments: { alignSelf: 'start', maxWidth: '100%' },
  /**
   * In a row of controls, such as a framed figure's strip, the slider takes the room the row has. The floor is a width
   * and not a flex basis, so a slider in a column keeps its own height.
   */
  slider: { flex: '1 1 0%', minWidth: 'min(12rem, 100%)' },
});

export type ParamControlProps = {
  /** The param's name in the lesson. */
  readonly name: string;
};

function kindError({
  part,
  name,
  param,
  needed,
}: {
  readonly part: string;
  readonly name: string;
  readonly param: LessonParam;
  readonly needed: LessonParam['kind'];
}): ReactNode {
  return <LessonError>{`${part} needs a ${needed} param, and "${name}" is a ${param.kind} param.`}</LessonError>;
}

/**
 * A labelled slider for a number param, for a figure's footer or a control panel. A log param slides evenly through
 * each tenfold. It reads and sets the same value as every `Param` and figure of the lesson.
 */
export function ParamSlider({ name }: ParamControlProps): ReactNode {
  const scope = useLessonScope('ParamSlider');
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return <LessonError>{found.error}</LessonError>;
  }

  if (found.param.kind !== 'number') {
    return kindError({ part: 'ParamSlider', name, param: found.param, needed: 'number' });
  }

  const { param } = found;
  const stored = scope.state.values[name];
  const value = typeof stored === 'number' ? stored : param.value;
  const isLog = param.scale === 'log';
  const range = { min: param.min, max: param.max, step: param.step };

  const position = isLog ? Math.round(fractionOf(value, range, 'log') * LOG_POSITIONS) : value;

  /** A position on a log slider lands on the step grid; where the grid is coarser, a move takes one grid step. */
  function valueOf(at: number): number {
    return isLog ? scrubTo(valueAt(at / LOG_POSITIONS, range, 'log'), range).value : at;
  }

  return (
    <Slider.Root<number>
      locale={scope.locale}
      value={position}
      onValueChange={(next, details) => {
        const target = valueOf(next);
        const isStuck = isLog && target === value && next !== position;

        scope.api.apply(name, isStuck ? stepValue(value, Math.sign(next - position), range) : target, details);
      }}
      min={isLog ? 0 : param.min}
      max={isLog ? LOG_POSITIONS : param.max}
      step={isLog ? 1 : param.step}
      format={
        isLog ? (at) => formatValue({ value: valueOf(at), locale: scope.locale, format: param.format }) : param.format
      }
      disabled={scope.state.isReadOnly}
      xstyle={styles.slider}
    >
      <Row shouldSpaceBetween>
        <Slider.Label>{param.label}</Slider.Label>
        <Slider.Value />
      </Row>
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        <Slider.Thumb />
      </Slider.Control>
    </Slider.Root>
  );
}

/** A labelled segmented control for a choice param with a few options. */
export function ParamChoice({ name }: ParamControlProps): ReactNode {
  const scope = useLessonScope('ParamChoice');
  const labelId = useId();
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return <LessonError>{found.error}</LessonError>;
  }

  if (found.param.kind !== 'choice') {
    return kindError({ part: 'ParamChoice', name, param: found.param, needed: 'choice' });
  }

  const { param } = found;
  const stored = scope.state.values[name];

  return (
    <div {...stylex.props(styles.control)}>
      <span id={labelId} {...stylex.props(styles.label)}>
        {param.label}
      </span>
      <SegmentedControl.Root<string>
        value={typeof stored === 'string' ? stored : param.value}
        onValueChange={(next, details) => scope.api.apply(name, next, details)}
        disabled={scope.state.isReadOnly}
        aria-labelledby={labelId}
        xstyle={styles.segments}
      >
        {param.options.map((option) => (
          <SegmentedControl.Item key={option.id} value={option.id}>
            {option.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </div>
  );
}

/** A labelled switch for a toggle param. */
export function ParamToggle({ name }: ParamControlProps): ReactNode {
  const scope = useLessonScope('ParamToggle');
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return <LessonError>{found.error}</LessonError>;
  }

  if (found.param.kind !== 'toggle') {
    return kindError({ part: 'ParamToggle', name, param: found.param, needed: 'toggle' });
  }

  return (
    <Field.Root>
      <Field.Label>
        <Row>
          <Switch.Root
            checked={scope.state.values[name] === true}
            onCheckedChange={(next, details) => scope.api.apply(name, next, details)}
            disabled={scope.state.isReadOnly}
          >
            <Switch.Thumb />
          </Switch.Root>
          {found.param.label}
        </Row>
      </Field.Label>
    </Field.Root>
  );
}

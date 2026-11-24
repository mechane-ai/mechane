import { CurveChart } from '@mechane-ai/elements/charts/trend';
import { useLesson } from '@mechane-ai/elements/lesson';
import { Scene, SceneNode, SceneWire } from '@mechane-ai/elements/scene';
import type { ReactNode } from 'react';
import { LAST_STEP, lesson } from './lesson.ts';

/** The loss never plots below this, so a loss of exactly zero stays on the log axis. */
const LOSS_FLOOR = 1e-6;
const LOSS_CEILING = 1e3;

/** The loss after `steps` steps at `rate`: the weight shrinks by 1 − 2 × rate each step, and the loss is its square. */
function lossAfter(rate: number, steps: number): number {
  return Math.max(((1 - 2 * rate) ** steps) ** 2, LOSS_FLOOR);
}

const steps = Array.from({ length: LAST_STEP + 1 }, (_, step) => step);

/** The loss at every step for the learning rate the reader chose, with the step they are at marked. */
export function LossCurve(): ReactNode {
  const { values, locale } = useLesson(lesson);

  return (
    <CurveChart
      title="Loss by step"
      description="Synthetic loss of gradient descent on w squared, from step 0 to step 10."
      locale={locale}
      series={[
        {
          id: 'loss',
          label: 'Loss',
          tone: 'series1',
          points: steps.map((step) => ({ x: step, y: lossAfter(values.rate, step) })),
        },
      ]}
      x={{ label: 'Step', domain: [0, LAST_STEP], format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Loss', scale: 'log', domain: [LOSS_FLOOR, LOSS_CEILING], format: { maximumSignificantDigits: 2 } }}
      references={[{ id: 'start', label: 'Loss at the start', y: 1 }]}
      markers={[{ x: values.steps, label: 'Now' }]}
      labels="none"
      height="regular"
    />
  );
}

/** One step drawn as a scene: the weight, its slope, and the weight after the step. */
export function UpdateRule(): ReactNode {
  const { values, locale } = useLesson(lesson);
  const number = new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 });
  const next = values.weight * (1 - 2 * values.rate);
  const isGrowing = Math.abs(next) > Math.abs(values.weight);

  return (
    <Scene
      title="One step of gradient descent"
      description="Synthetic numbers. The slope of the loss is twice the weight, and the step moves the weight against it."
      locale={locale}
      x={[0, 3]}
      y={[0, 1]}
      weightMax={1.2}
      height="compact"
    >
      <SceneNode
        id="weight"
        at={[0.5, 0.5]}
        text={`w = ${number.format(values.weight)}`}
        label={`The weight now is ${number.format(values.weight)}`}
      />
      <SceneNode
        id="slope"
        at={[1.5, 0.5]}
        text={`slope ${number.format(2 * values.weight)}`}
        label={`The slope of the loss is twice the weight, ${number.format(2 * values.weight)}`}
        shape="pill"
      />
      <SceneNode
        id="next"
        at={[2.5, 0.5]}
        text={`next ${number.format(next)}`}
        label={`The weight after this step is ${number.format(next)}`}
        tone={isGrowing ? 'negative' : 'positive'}
      />
      <SceneWire from="weight" to="slope" label="The slope is twice the weight" />
      <SceneWire
        from="slope"
        to="next"
        weight={values.rate}
        text={`× ${number.format(values.rate)}`}
        label={`The step is the slope times the learning rate, ${number.format(values.rate)}`}
      />
    </Scene>
  );
}

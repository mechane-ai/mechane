import * as stylex from '@stylexjs/stylex';
import { use } from 'react';
import type { ReactNode } from 'react';
import { formatValue, plotHeights } from '../../../../charts/src/index.ts';
import type { ChartTone, NumericDomain, PlotHeight } from '../../../../charts/src/index.ts';
import { typography } from '../../../../foundations/src/tokens.stylex.ts';
import { lessonGraph } from '../../lesson/define-lesson.ts';
import type { AnyLesson, LessonParam, LessonValue } from '../../lesson/define-lesson.ts';
import { LessonContext, scopeOf } from '../../lesson/lesson-context.ts';
import type { LessonScope } from '../../lesson/lesson-context.ts';
import { Param } from '../../lesson/param.tsx';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { SceneNode } from '../scene-node.tsx';
import { fillLabel } from '../scene-validate.ts';
import type { SceneLabels } from '../scene-validate.ts';
import { SceneWire } from '../scene-wire.tsx';
import { Scene } from '../scene.tsx';
import type { SceneProps } from '../scene.tsx';
import { flowPlan, flowPositions, unknownFlowName } from './flow-layout.ts';
import type { FlowDirection, FlowPlan } from './flow-layout.ts';
import { FlowPulse } from './flow-pulse.tsx';

/** The words a flow shows that are not the author's content. Placeholders in braces are filled in. */
export type SceneFlowLabels = {
  readonly noLesson: string;
  /** `{name}` is the name the author gave, `{lesson}` the lesson's id. */
  readonly unknownName: string;
  /** `{count}` is how many values share one column, `{limit}` how many the plot holds. */
  readonly crowded: string;
  /** The readout sentence of a value: `{label}` and its `{value}` in its format. */
  readonly node: string;
  /** Appended to a derived value's sentence when it has a formula: `{formula}`. */
  readonly formula: string;
  /** Appended to a value's sentence: `{names}` are the labels of the values it reads. */
  readonly reads: string;
  readonly on: string;
  readonly off: string;
};

export const sceneFlowLabels = {
  noLesson: 'SceneFlow needs a Lesson around it that renders its lesson.',
  unknownName: 'The flow names "{name}", which lesson "{lesson}" does not declare.',
  crowded: 'The flow stacks {count} values in one column, and this plot holds {limit}. Show fewer with `names`.',
  node: '{label}: {value}',
  formula: ', {formula}',
  reads: '. Reads {names}',
  on: 'on',
  off: 'off',
} as const satisfies SceneFlowLabels;

/** The pixel box of each value in a flow, big enough for a two-line label and an inline control. */
export const flowNodeSize = { width: 128, height: 64 } as const;

/** The room kept between two values of one column, in pixels. */
const ROW_GAP = 16;
const PLOT_EDGE = 8;
const SIDES = 2;
const heightNames: ReadonlyArray<PlotHeight> = ['compact', 'regular', 'tall'];

const styles = stylex.create({
  value: {
    display: 'block',
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: typography.strongWeight,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  control: { display: 'flex', justifyContent: 'center', fontFamily: typography.fontFamily },
});

export type SceneFlowProps = {
  /** The lesson to draw. Left out, the nearest `Lesson`'s. A `Lesson` that renders it must enclose the flow. */
  readonly lesson?: AnyLesson | undefined;
  /** Draw only these values and every value they read. Left out, the whole lesson. */
  readonly names?: ReadonlyArray<string> | undefined;
  /** Layers from left to right, or from top to bottom. Defaults to `across`. */
  readonly layout?: FlowDirection | undefined;
  /** The part of the scene's data box the flow fills. Left out, the whole box. */
  readonly at?: { readonly x: NumericDomain; readonly y: NumericDomain } | undefined;
  /** Plain text for a derived value's readout, by name, such as `−log₂ p`. */
  readonly formula?: Readonly<Record<string, string>> | undefined;
  /** The pixel box of each value. Defaults to `flowNodeSize`. */
  readonly size?: { readonly width: number; readonly height: number } | undefined;
  /** The hue of the pulse that shows a change. Left out, ink. */
  readonly tone?: ChartTone | undefined;
  readonly labels?: Partial<SceneFlowLabels> | undefined;
};

/** The lesson scope a flow reads: the one that renders `lesson`, or the nearest. */
function useFlowScope(lesson: AnyLesson | undefined): LessonScope | null {
  const nearest = use(LessonContext);

  return lesson === undefined ? nearest : scopeOf(nearest, lesson);
}

/** A param's value as the reader sees it: a number in its format, an option's label, or a toggle's word. */
function paramText({
  param,
  value,
  locale,
  labels,
}: {
  readonly param: LessonParam;
  readonly value: LessonValue | undefined;
  readonly locale: string;
  readonly labels: SceneFlowLabels;
}): string {
  if (param.kind === 'number') {
    return formatValue({ value: typeof value === 'number' ? value : null, locale, format: param.format });
  }

  if (param.kind === 'toggle') {
    return value === true ? labels.on : labels.off;
  }

  return param.options.find((option) => option.id === value)?.label ?? String(value);
}

/** An author error reported through the scene, which shows it in place of the plot. */
function FlowProblem({ problem }: { readonly problem: string }): ReactNode {
  useSceneObject({ id: 'scene-flow:problem', kind: 'flow', values: {}, problem });

  return null;
}

/** How many values fit in one column of a flow on a plot of `height` pixels with nodes `size` tall. */
function columnLimit(height: number, size: number): number {
  const inner = height - size - SIDES * PLOT_EDGE;

  return 1 + Math.max(0, Math.floor(inner / (size + ROW_GAP)));
}

type FlowDiagramProps = {
  readonly scope: LessonScope;
  readonly plan: FlowPlan;
  readonly box: { readonly x: NumericDomain; readonly y: NumericDomain };
  readonly layout: FlowDirection;
  readonly formula: Readonly<Record<string, string>>;
  readonly size: { readonly width: number; readonly height: number };
  readonly tone: ChartTone | undefined;
  readonly labels: SceneFlowLabels;
};

function FlowDiagram({ scope, plan, box, layout, formula, size, tone, labels }: FlowDiagramProps): ReactNode {
  const scene = useSceneContext();
  const { lesson, values, locale } = scope;
  const positions = flowPositions({ plan, box, direction: layout });
  const params = new Map(Object.entries(lesson.params));
  const derived = new Map(Object.entries(lesson.derived));
  const titles = new Map(plan.slots.map((slot) => [slot.name, slot.label]));
  const formulas = new Map(Object.entries(formula));

  return (
    <>
      {plan.slots.map((slot) => {
        const param = params.get(slot.name);
        const format = derived.get(slot.name)?.format;
        const value = values[slot.name];

        const text =
          param === undefined
            ? formatValue({ value: typeof value === 'number' ? value : null, locale, format: format ?? {} })
            : paramText({ param, value, locale, labels });

        const inputs = plan.edges.filter((edge) => edge.to === slot.name).map((edge) => titles.get(edge.from) ?? '');

        const written = formulas.get(slot.name);

        const sentence = [
          fillLabel(labels.node, { label: slot.label, value: text }),
          written === undefined ? '' : fillLabel(labels.formula, { formula: written }),
          inputs.length === 0 ? '' : fillLabel(labels.reads, { names: inputs.join(', ') }),
        ].join('');

        return (
          <SceneNode
            key={slot.name}
            id={slot.name}
            at={positions.get(slot.name) ?? [box.x[0], box.y[0]]}
            size={size}
            text={slot.label}
            label={sentence}
          >
            {param === undefined ? (
              <span {...stylex.props(styles.value)}>{text}</span>
            ) : (
              <span {...stylex.props(styles.control)}>
                <Param name={slot.name} />
              </span>
            )}
          </SceneNode>
        );
      })}
      {plan.edges.map((edge) => (
        <SceneWire key={`${edge.from}>${edge.to}`} from={edge.from} to={edge.to} />
      ))}
      <FlowPulse plan={plan} values={values} pace={scene.pace} tone={tone} />
    </>
  );
}

/**
 * A lesson's derivation drawn live inside a `Scene`: each param and derived value is a node in layers left to right,
 * wired to the values it reads. Params are inline controls, every value shows its current text, and a change glows
 * through what it touched. Inspecting a value lights what it reads and what reads it.
 */
export function SceneFlow({
  lesson,
  names,
  layout = 'across',
  at,
  formula = {},
  size = flowNodeSize,
  tone,
  labels: labelInput,
}: SceneFlowProps): ReactNode {
  const scene = useSceneContext();
  const scope = useFlowScope(lesson);
  const labels = { ...sceneFlowLabels, ...labelInput };

  if (!scene.isInScene) {
    return <SceneOutside part="SceneFlow" />;
  }

  if (scope === null) {
    return <FlowProblem problem={labels.noLesson} />;
  }

  const graph = lessonGraph(scope.lesson);
  const unknown = names === undefined ? undefined : unknownFlowName(graph, names);

  if (unknown !== undefined) {
    return <FlowProblem problem={fillLabel(labels.unknownName, { name: unknown, lesson: scope.lesson.id })} />;
  }

  const plan = flowPlan(graph, names);
  const box = at ?? scene.domain;
  const isAcross = layout === 'across';
  const column = isAcross ? plan.rows : plan.layers;
  const pixelsPerUnit = scene.box.innerHeight / (scene.domain.y[1] - scene.domain.y[0]);
  const columnPixels = Math.abs(box.y[1] - box.y[0]) * pixelsPerUnit;
  const pitch = column > 1 ? columnPixels / (column - 1) : Number.POSITIVE_INFINITY;

  if (pitch < size.height + ROW_GAP) {
    const limit = 1 + Math.max(0, Math.floor(columnPixels / (size.height + ROW_GAP)));

    return <FlowProblem problem={fillLabel(labels.crowded, { count: String(column), limit: String(limit) })} />;
  }

  return (
    <LessonContext value={scope}>
      <FlowDiagram
        scope={scope}
        plan={plan}
        box={box}
        layout={layout}
        formula={formula}
        size={size}
        tone={tone}
        labels={labels}
      />
    </LessonContext>
  );
}

export type LessonFlowProps = Omit<SceneProps, 'x' | 'y' | 'title' | 'height' | 'aspect' | 'children' | 'labels'> &
  Omit<SceneFlowProps, 'at' | 'labels'> & {
    /** The flow's words and the scene's words in one object. */
    readonly labels?: (Partial<SceneFlowLabels> & Partial<SceneLabels>) | undefined;
    /** Left out, the lesson's title. */
    readonly title?: string | undefined;
    /** Left out, the smallest named height whose columns hold the flow's busiest layer. */
    readonly height?: PlotHeight | undefined;
    /** More scene parts drawn with the flow, such as a `SceneCallout` on one of its values. */
    readonly children?: ReactNode;
  };

/**
 * A lesson's derivation as a figure of its own: a `Scene` sized to the flow, with `SceneFlow` inside. Use it beside the
 * prose and controls of a lesson; the author supplies only a title and description, or nothing.
 */
export function LessonFlow({
  lesson,
  names,
  layout = 'across',
  formula,
  size = flowNodeSize,
  tone,
  labels,
  title,
  height,
  children,
  ...scene
}: LessonFlowProps): ReactNode {
  const scope = useFlowScope(lesson);
  const plan = scope === null ? undefined : flowPlan(lessonGraph(scope.lesson), names);
  const layers = plan?.layers ?? 1;
  const rows = plan?.rows ?? 1;
  const isAcross = layout === 'across';
  const across = isAcross ? layers : rows;
  const down = isAcross ? rows : layers;
  const fitted = heightNames.find((name) => columnLimit(plotHeights[name], size.height) >= down) ?? 'tall';

  return (
    <Scene
      {...scene}
      labels={labels}
      title={title ?? scope?.lesson.title ?? ''}
      x={[0, Math.max(1, across - 1)]}
      y={[0, Math.max(1, down - 1)]}
      height={height ?? fitted}
    >
      <SceneFlow
        lesson={lesson}
        names={names}
        layout={layout}
        formula={formula}
        size={size}
        tone={tone}
        labels={labels}
      />
      {children}
    </Scene>
  );
}

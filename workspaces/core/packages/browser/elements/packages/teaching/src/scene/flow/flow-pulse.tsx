import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { colors } from '../../../../foundations/src/tokens.stylex.ts';
import type { LessonValue } from '../../lesson/define-lesson.ts';
import { isMotionReduced } from '../../time/clock.ts';
import { createTween } from '../../time/tween.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneFrames } from '../scene-context.ts';
import { edgePoint, padRect, rectCenter } from '../scene-geometry.ts';
import { SceneLayer } from '../scene-layer.tsx';
import type { FlowPlan } from './flow-layout.ts';

/** The values one change touched: each one's step in the wave, counted in layers from the first. */
type Pulse = {
  readonly steps: ReadonlyMap<string, number>;
  readonly edges: FlowPlan['edges'];
  /** Reduced motion: the touched values are marked at rest, with no wave. */
  readonly isStill: boolean;
};

const RING_GAP = 3;
const RING_GROW = 6;
const RING_RADIUS = 10;
const DOT_RADIUS = 4.5;
const STILL_STRENGTH = 0.85;
const PEAK = 0.5;

const styles = stylex.create({
  ring: (color: string, opacity: number) => ({
    fill: `color-mix(in srgb, ${color} 10%, transparent)`,
    stroke: color,
    strokeWidth: 2,
    opacity,
    pointerEvents: 'none',
  }),
  still: { strokeDasharray: '4 3' },
  dot: (color: string) => ({ fill: color, stroke: colors.surface, strokeWidth: 1.5, pointerEvents: 'none' }),
});

function isSameSteps(first: ReadonlyMap<string, number>, second: ReadonlyMap<string, number>): boolean {
  return first.size === second.size && [...first].every(([name, step]) => second.get(name) === step);
}

/** How strongly a value at `step` glows while the wave is at `wave`: once, rising and falling over one step. */
function glow(wave: number, step: number): number {
  const along = wave - step;

  return along <= 0 || along >= 1 ? 0 : Math.sin(along * Math.PI);
}

/**
 * Shows a lesson change as a cause: the values that changed glow once, layer after layer, and a dot runs along each
 * wire between them. With reduced motion the touched values are marked at rest instead. It draws nothing until a value
 * changes.
 */
export function FlowPulse({
  plan,
  values,
  pace,
  tone,
}: {
  readonly plan: FlowPlan;
  readonly values: Readonly<Record<string, LessonValue | undefined>>;
  readonly pace: Pace;
  readonly tone: ChartTone | undefined;
}): ReactNode {
  const [tween] = useState(() => createTween({ wave: 0 }));
  const [run] = useState(() => ({ target: 0, end: 0 }));
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const seen = useRef(values);
  const shown = useSyncExternalStore(tween.subscribe, tween.get, tween.get);
  const names = pulse === null ? [] : [...pulse.steps.keys()];
  const frames = useSceneFrames(names);

  useLayoutEffect(() => {
    const previous = seen.current;

    seen.current = values;

    const changed = plan.slots.filter((slot) => !Object.is(previous[slot.name], values[slot.name]));

    if (changed.length === 0) {
      return;
    }

    const first = Math.min(...changed.map((slot) => slot.layer));
    const steps = new Map(changed.map((slot) => [slot.name, slot.layer - first]));
    const isStill = isMotionReduced() || pace === 'instant';
    const isInFlight = pulse !== null && !pulse.isStill && tween.get().wave < run.end;

    if (isInFlight && !isStill && isSameSteps(pulse.steps, steps)) {
      return;
    }

    const edges = plan.edges.filter((edge) => steps.has(edge.from) && steps.has(edge.to));

    setPulse({ steps, edges, isStill });
    tween.jump({ wave: 0 });

    run.target = 0;
    run.end = isStill ? 0 : 1 + Math.max(...steps.values());

    if (!isStill) {
      run.target = 1;

      tween.to({ wave: 1 }, pace);
    }
  });

  useEffect(
    () =>
      tween.subscribe(() => {
        const isAtTarget = tween.get().wave >= run.target;

        if (isAtTarget && run.target < run.end) {
          run.target += 1;

          tween.to({ wave: run.target }, pace);
        }
      }),
    [tween, run, pace],
  );

  useEffect(() => tween.destroy, [tween]);

  if (pulse === null) {
    return null;
  }

  const color = tone === undefined ? colors.ink : chartToneColors[tone];

  const rects = new Map(
    names.flatMap((name, index) => {
      const rect = frames[index]?.rect;

      return rect === undefined ? [] : [[name, rect] as const];
    }),
  );

  const rings = names.flatMap((name) => {
    const rect = rects.get(name);
    const step = pulse.steps.get(name) ?? 0;
    const strength = pulse.isStill ? STILL_STRENGTH : glow(shown.wave, step);

    if (rect === undefined || strength <= 0) {
      return [];
    }

    const halo = padRect(rect, RING_GAP + (pulse.isStill ? 0 : RING_GROW * strength));

    return [
      <rect
        key={name}
        data-flow-pulse={name}
        x={halo.left}
        y={halo.top}
        width={halo.right - halo.left}
        height={halo.bottom - halo.top}
        rx={RING_RADIUS}
        ry={RING_RADIUS}
        {...stylex.props(styles.ring(color, strength), pulse.isStill && styles.still)}
      />,
    ];
  });

  const dots = pulse.isStill
    ? []
    : pulse.edges.flatMap((edge) => {
        const source = rects.get(edge.from);
        const target = rects.get(edge.to);
        const from = pulse.steps.get(edge.from) ?? 0;
        const to = pulse.steps.get(edge.to) ?? 0;
        const along = (shown.wave - from - PEAK) / Math.max(1, to - from);

        const isMoving = along > 0 && along < 1;

        if (source === undefined || target === undefined || !isMoving) {
          return [];
        }

        const start = edgePoint({ rect: source, shape: 'box', toward: rectCenter(target) });
        const end = edgePoint({ rect: target, shape: 'box', toward: rectCenter(source) });

        return [
          <circle
            key={`${edge.from}>${edge.to}`}
            data-flow-dot={`${edge.from}>${edge.to}`}
            cx={start.x + (end.x - start.x) * along}
            cy={start.y + (end.y - start.y) * along}
            r={DOT_RADIUS}
            {...stylex.props(styles.dot(color))}
          />,
        ];
      });

  return (
    <>
      <SceneLayer layer="back">{rings}</SceneLayer>
      <SceneLayer layer="front">{dots}</SceneLayer>
    </>
  );
}

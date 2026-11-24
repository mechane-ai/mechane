import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import { colors, radii, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { createTween } from '../../time/tween.ts';
import type { Pace, Tween } from '../../time/tween.ts';
import type { SceneRect } from '../scene-geometry.ts';
import { fillLabel } from '../scene-validate.ts';

/** The words a morph shows that are not the author's content. */
export type MorphLabels = {
  /** `{name}` is the figure `show` names, `{names}` the figures given. */
  readonly unknownFigure: string;
};

export const morphLabels = {
  unknownFigure: 'MorphScope shows "{name}", which is not one of its figures: {names}.',
} as const satisfies MorphLabels;

export type MorphScopeProps<Name extends string> = {
  /** The figures by name. Each stays mounted and keeps its state while another is shown. */
  readonly figures: Readonly<Record<Name, ReactNode>>;
  /** The figure on screen. Change it and every thing both figures draw travels to its place in the new one. */
  readonly show: Name;
  /** How fast the figures trade places. Defaults to `slow`. Reduced motion swaps at once. */
  readonly pace?: Pace | undefined;
  /** The hue of each thing's travelling shape, by id. Left out, the tone scope's, or neutral. */
  readonly tones?: Readonly<Record<string, ChartTone>> | undefined;
  readonly labels?: Partial<MorphLabels> | undefined;
};

/** The attributes that carry a thing's id in a figure's markup: a scene node's, and a chart mark's. */
const idAttributes: ReadonlyArray<string> = ['data-scene-node', 'data-chart-mark'];

/** Marks that belong to a scene part, such as a wire's hit path, which the scene node or wire already names. */
const SCENE_PART = '[data-scene-node] [data-chart-mark], [data-scene-wire] [data-chart-mark]';

/** One thing drawn in both figures, with its rectangle in each, relative to the scope. */
type Travel = { readonly id: string; readonly from: SceneRect; readonly to: SceneRect };

type Flight = { readonly from: string; readonly travels: ReadonlyArray<Travel> };

/** The share of the move over which the old figure fades out, and over which the new one fades in at the end. */
const FADE_SHARE = 1 / 3;
const BORDER_WIDTH = 1.5;

const styles = stylex.create({
  scope: { position: 'relative', display: 'grid', minWidth: 0 },
  figure: (opacity: number) => ({ gridArea: '1 / 1', minWidth: 0, opacity }),
  hidden: { visibility: 'hidden', pointerEvents: 'none' },
  ghosts: { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' },
  place: (transform: string, width: number, height: number) => ({ width, height, transform }),
  ghost: (color: string) => ({
    position: 'absolute',
    left: 0,
    top: 0,
    boxSizing: 'border-box',
    borderWidth: BORDER_WIDTH,
    borderStyle: 'solid',
    borderColor: color,
    borderRadius: radii.md,
    backgroundColor: `color-mix(in srgb, ${color} 18%, ${colors.surface})`,
  }),
  fade: (opacity: number) => ({ opacity }),
  error: { color: colors.danger, fontFamily: typography.fontFamily, fontWeight: typography.strongWeight },
});

function area(rect: SceneRect): number {
  return (rect.right - rect.left) * (rect.bottom - rect.top);
}

/**
 * The rectangle of every thing with an id inside `root`, relative to `origin`. Where a chart draws a mark and a larger
 * hit target with one id, the smaller is the mark the reader sees.
 */
function measure(root: HTMLElement, origin: DOMRect): ReadonlyMap<string, SceneRect> {
  const selector = idAttributes.map((name) => `[${name}]`).join(',');
  const elements = Array.from(root.querySelectorAll(selector)).filter((element) => !element.matches(SCENE_PART));

  const found = elements.map((element) => {
    const id = idAttributes.map((name) => element.getAttribute(name)).find((value) => value !== null) ?? '';
    const rect = element.getBoundingClientRect();

    return {
      id,
      rect: {
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        right: rect.right - origin.left,
        bottom: rect.bottom - origin.top,
      },
    };
  });

  const smallest = found.toSorted((first, second) => area(second.rect) - area(first.rect));

  return new Map(smallest.map((item) => [item.id, item.rect] as const));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamped(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** How visible a figure is at `progress`: the one left fades first, the one arriving appears last. */
function figureOpacity({
  name,
  show,
  flight,
  progress,
}: {
  readonly name: string;
  readonly show: string;
  readonly flight: Flight | null;
  readonly progress: number;
}): number {
  if (name === show) {
    return flight === null ? 1 : clamped((progress - (1 - FADE_SHARE)) / FADE_SHARE);
  }

  return flight?.from === name ? clamped(1 - progress / FADE_SHARE) : 0;
}

function MorphFigure({
  name,
  opacity,
  isShown,
  setRoot,
  children,
}: {
  readonly name: string;
  readonly opacity: number;
  readonly isShown: boolean;
  readonly setRoot: (name: string, element: HTMLDivElement | null) => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div
      ref={(element) => setRoot(name, element)}
      data-morph-figure={name}
      aria-hidden={isShown ? undefined : true}
      inert={!isShown}
      {...stylex.props(styles.figure(opacity), opacity === 0 && styles.hidden)}
    >
      {children}
    </div>
  );
}

function Ghost({
  travel,
  progress,
  tone,
}: {
  readonly travel: Travel;
  readonly progress: number;
  readonly tone: ChartTone | undefined;
}): ReactNode {
  const scoped = useScopedTone(travel.id);
  const { from, to } = travel;
  const left = mix(from.left, to.left, progress);
  const top = mix(from.top, to.top, progress);
  const width = mix(from.right - from.left, to.right - to.left, progress);
  const height = mix(from.bottom - from.top, to.bottom - to.top, progress);
  const opacity = clamped(Math.min(progress, 1 - progress) / FADE_SHARE);
  const color = chartToneColors[tone ?? scoped ?? 'neutral'];

  return (
    <div
      data-morph-ghost={travel.id}
      {...stylex.props(
        styles.ghost(color),
        styles.place(`translate(${left}px, ${top}px)`, width, height),
        styles.fade(opacity),
      )}
    />
  );
}

function Ghosts({
  tween,
  flight,
  tones,
}: {
  readonly tween: Tween<'progress'>;
  readonly flight: Flight | null;
  readonly tones: Readonly<Record<string, ChartTone>>;
}): ReactNode {
  const { progress } = useSyncExternalStore(tween.subscribe, tween.get, tween.get);
  const pinned = new Map(Object.entries(tones));
  const isMoving = progress > 0 && progress < 1;

  if (flight === null || !isMoving) {
    return null;
  }

  return (
    <div aria-hidden {...stylex.props(styles.ghosts)}>
      {flight.travels.map((travel) => (
        <Ghost key={travel.id} travel={travel} progress={progress} tone={pinned.get(travel.id)} />
      ))}
    </div>
  );
}

function Figures<Name extends string>({
  tween,
  flight,
  show,
  figures,
  setRoot,
}: {
  readonly tween: Tween<'progress'>;
  readonly flight: Flight | null;
  readonly show: Name;
  readonly figures: Readonly<Record<Name, ReactNode>>;
  readonly setRoot: (name: string, element: HTMLDivElement | null) => void;
}): ReactNode {
  const { progress } = useSyncExternalStore(tween.subscribe, tween.get, tween.get);
  const entries: ReadonlyArray<readonly [string, ReactNode]> = Object.entries<ReactNode>(figures);

  return entries.map(([name, figure]) => (
    <MorphFigure
      key={name}
      name={name}
      opacity={figureOpacity({ name, show, flight, progress })}
      isShown={name === show}
      setRoot={setRoot}
    >
      {figure}
    </MorphFigure>
  ));
}

/**
 * Two or more figures that show the same things, one at a time. When `show` changes, each thing drawn in both, matched
 * by id, travels from its place in the old figure to its place in the new one while the figures cross-fade. Use it when
 * a card becomes a bar, or a neuron a dot: the author names the figure to show and nothing else.
 */
export function MorphScope<Name extends string>({
  figures,
  show,
  pace = 'slow',
  tones = {},
  labels: labelInput,
}: MorphScopeProps<Name>): ReactNode {
  const labels = { ...morphLabels, ...labelInput };
  const scopeRef = useRef<HTMLDivElement>(null);
  const [roots] = useState(() => new Map<string, HTMLDivElement>());
  const [tween] = useState(() => createTween({ progress: 1 }));
  const [flight, setFlight] = useState<Flight | null>(null);
  const last = useRef<string>(show);
  const names = Object.keys(figures);
  const isKnown = names.includes(show);

  useLayoutEffect(() => {
    const previous = last.current;
    const scope = scopeRef.current;

    last.current = show;

    if (previous === show || scope === null) {
      return;
    }

    const origin = scope.getBoundingClientRect();
    const fromRoot = roots.get(previous);
    const toRoot = roots.get(show);
    const before = fromRoot === undefined ? new Map<string, SceneRect>() : measure(fromRoot, origin);
    const after = toRoot === undefined ? new Map<string, SceneRect>() : measure(toRoot, origin);

    const travels = [...before].flatMap(([id, from]) => {
      const to = after.get(id);

      return to === undefined ? [] : [{ id, from, to }];
    });

    setFlight({ from: previous, travels });
    tween.jump({ progress: 0 });
    tween.to({ progress: 1 }, pace);
  }, [show, pace, roots, tween]);

  useEffect(() => tween.destroy, [tween]);

  if (!isKnown) {
    return (
      <span role="note" {...stylex.props(styles.error)}>
        {fillLabel(labels.unknownFigure, { name: show, names: names.join(', ') })}
      </span>
    );
  }

  return (
    <div ref={scopeRef} data-morph-scope="" {...stylex.props(styles.scope)}>
      <Figures
        tween={tween}
        flight={flight}
        show={show}
        figures={figures}
        setRoot={(name, element) => {
          if (element === null) {
            roots.delete(name);
          } else {
            roots.set(name, element);
          }
        }}
      />
      <Ghosts tween={tween} flight={flight} tones={tones} />
    </div>
  );
}

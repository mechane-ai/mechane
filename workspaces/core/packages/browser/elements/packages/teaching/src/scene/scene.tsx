import * as stylex from '@stylexjs/stylex';
import { Children, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useLinkedInspection } from '../../../charts/src/index.ts';
import type { FigureProps, FigureSelectionProps, NumericDomain, PlotHeight } from '../../../charts/src/index.ts';
import {
  Chart,
  ChartData,
  ChartPlot,
  ChartReadout,
  FigureEmpty,
  FigureFrame,
  FigureInvalid,
  FigureLoading,
  inspectedLabel,
  plotBox,
  plotLabel,
  usePlotSize,
  useTones,
} from '../../../charts/src/plot/index.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useLessonLocale } from '../lesson/lesson-locale.ts';
import { onFrame } from '../time/clock.ts';
import { createTween } from '../time/tween.ts';
import type { Pace } from '../time/tween.ts';
import { cachedScales, frameRect, SceneMarksContext, SceneSetupContext } from './scene-context.ts';
import type { SceneSetup } from './scene-context.ts';
import { cameraView, keyboardPlaces, sceneMargins, sceneMinWidth, unionRect } from './scene-geometry.ts';
import type { SceneFrame, SceneRect } from './scene-geometry.ts';
import { createSceneRegistry } from './scene-registry.ts';
import type { SceneMember, SceneRegistry } from './scene-registry.ts';
import { membersError, sceneBoxError, sceneLabels } from './scene-validate.ts';
import type { SceneLabels } from './scene-validate.ts';

export type SceneProps = Omit<FigureProps, 'locale'> &
  FigureSelectionProps & {
    /** The locale of every number in the figure. Left out, the nearest `Lesson`'s locale is used. */
    readonly locale?: string | undefined;
    /** The data box's horizontal extent. Object positions are in these units. */
    readonly x: NumericDomain;
    /** The data box's vertical extent. y grows upward, as on a chart. */
    readonly y: NumericDomain;
    /** The plot height by name. Ignored when `aspect` is set. */
    readonly height?: PlotHeight | undefined;
    /** The plot's width divided by its height, for a scene that keeps its proportions as it narrows. */
    readonly aspect?: number | undefined;
    /** The camera: the ids to zoom to, with room around them. Null or absent shows the whole box. */
    readonly focus?: string | ReadonlyArray<string> | null | undefined;
    /** How fast changes ease. Reduced motion always jumps. */
    readonly pace?: Pace | undefined;
    /**
     * The narrowest plot in pixels; below it the plot scrolls inside the frame. Left out, it is the width at which no
     * two objects on the same row touch. Set it only to keep more room than the objects need.
     */
    readonly minWidth?: number | undefined;
    /** The wire weight magnitude drawn thickest. Weights must lie within plus or minus this. Defaults to 1. */
    readonly weightMax?: number | undefined;
    readonly labels?: Partial<SceneLabels> | undefined;
    /** The scene parts: `SceneNode`, `SceneWire`, `SceneGroup` and the rest, or components that render them. */
    readonly children?: ReactNode;
  };

const FOCUS_PADDING = 24;
const SCROLL_MARGIN = 32;

const styles = stylex.create({
  measure: { minWidth: 0, contain: 'inline-size' },
  scroller: { overflowX: 'auto', overflowY: 'hidden', minWidth: 0 },
  stage: (width: number, height: number) => ({ position: 'relative', width, height, overflow: 'hidden' }),
  plot: {
    'position': 'absolute',
    'inset': 0,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  svg: { display: 'block', overflow: 'hidden' },
  layer: { position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate' },
  error: {
    margin: 0,
    paddingBlock: spacing.md,
    paddingInline: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
  },
  missing: { color: colors.danger, fontFamily: typography.fontFamily, fontWeight: typography.strongWeight },
});

function focusList(focus: string | ReadonlyArray<string> | null): ReadonlyArray<string> {
  if (focus === null) {
    return [];
  }

  return typeof focus === 'string' ? [focus] : focus;
}

/** The frames the scene makes room for: shown, placed and not floating. */
function spaceFrame(member: SceneMember | undefined): SceneFrame | undefined {
  const isRoomy = member !== undefined && member.isShown && !member.isFloating;

  return isRoomy ? member.frame : undefined;
}

function framesOf(registry: SceneRegistry, id: string): ReadonlyArray<SceneFrame> {
  const member = registry.member(id);

  if (member === undefined) {
    return [];
  }

  if (member.frame !== undefined) {
    return [member.frame];
  }

  return member.attaches.flatMap((target) => {
    const frame = registry.member(target)?.frame;

    return frame === undefined ? [] : [frame];
  });
}

/** The ids at full strength: the inspected and active objects, what attaches to them, and what they attach to. */
function litIds(list: ReadonlyArray<SceneMember>, inspected: string | null): ReadonlySet<string> | null {
  const base = new Set([
    ...list.flatMap((member) => (member.isActive && member.isShown ? [member.id] : [])),
    ...(inspected === null ? [] : [inspected]),
  ]);

  if (base.size === 0) {
    return null;
  }

  const related = list.filter((member) => member.attaches.some((id) => base.has(id)));
  const reached = list.flatMap((member) => (base.has(member.id) ? member.attaches : []));
  const across = related.flatMap((member) => (member.kind === 'wire' ? member.attaches : []));

  return new Set([...base, ...related.map((member) => member.id), ...reached, ...across]);
}

function CursorInView({
  cursor,
  isActive,
  scrollerRef,
  place,
}: {
  readonly cursor: string | null;
  readonly isActive: boolean;
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
  readonly place: (id: string) => SceneRect | undefined;
}): ReactNode {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const rect = cursor === null ? undefined : place(cursor);

    if (!isActive || scroller === null || rect === undefined) {
      return;
    }

    const left = Math.min(
      rect.left - SCROLL_MARGIN,
      Math.max(scroller.scrollLeft, rect.right + SCROLL_MARGIN - scroller.clientWidth),
    );

    scroller.scrollTo({ left });
  });

  return null;
}

/**
 * A diagram with identity: nodes, wires, groups and notes placed in a data box, which move by themselves when their
 * props change. Authors describe each state; the scene eases between them, and a reader steps through labelled parts
 * with the arrow keys as in any chart. Use it for computation graphs, networks and other explanatory diagrams.
 */
export function Scene(props: SceneProps): ReactNode {
  const { x, y, height = 'regular', aspect, focus = null, pace = 'regular', minWidth, weightMax = 1 } = props;
  const { labels: labelInput, children, selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'This scene has nothing to draw.', locale: localeInput, ...frameInput } = figure;
  const lessonLocale = useLessonLocale();
  const labels = { ...sceneLabels, ...labelInput };
  const size = usePlotSize(height);
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();
  const [registry] = useState(createSceneRegistry);
  const [camera] = useState(() => createTween({ x0: x[0], x1: x[1], y0: y[0], y1: y[1] }));
  const members = useSyncExternalStore(registry.subscribe, registry.members, registry.members);
  const [back, setBack] = useState<SVGGElement | null>(null);
  const [wires, setWires] = useState<SVGGElement | null>(null);
  const [front, setFront] = useState<SVGGElement | null>(null);
  const [isKeyboardFocused, setKeyboardFocused] = useState(false);
  const [keyboard] = useState<{ places: ReadonlyMap<string, SceneRect> | null }>(() => ({ places: null }));
  const plotRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const domain = { x, y };
  const focusIds = focusList(focus);

  const placed = members.list.flatMap((member) => {
    const frame = spaceFrame(member);

    return frame === undefined ? [] : [frame];
  });

  const surrounds = members.list.flatMap((member) => {
    const { surround } = member;

    if (surround === undefined || !member.isShown) {
      return [];
    }

    return member.attaches.flatMap((target) => {
      const frame = spaceFrame(registry.member(target));

      return frame === undefined ? [] : [{ ...frame, outset: surround }];
    });
  });

  const edged = [...placed, ...surrounds];

  const reserved = members.list.flatMap((member) =>
    member.isShown && member.margins !== undefined ? [member.margins] : [],
  );

  const stageHeight = aspect === undefined ? size.height : Math.round(size.width / aspect);
  const fitted = sceneMargins({ frames: edged, reserved, domain, width: size.width, height: stageHeight });
  const innerHeight = stageHeight - fitted.top - fitted.bottom;

  const links = members.list.flatMap((member) => {
    const [from, to] = member.kind === 'wire' && member.isShown ? member.attaches : [];
    const first = from === undefined ? undefined : spaceFrame(registry.member(from));
    const second = to === undefined ? undefined : spaceFrame(registry.member(to));

    return first === undefined || second === undefined ? [] : [{ from: first, to: second, room: member.room }];
  });

  const derivedWidth = sceneMinWidth({ frames: placed, edged, links, domain, innerHeight, reserved });
  const stageWidth = Math.max(size.width, minWidth ?? derivedWidth);

  const margins =
    stageWidth === size.width
      ? fitted
      : sceneMargins({ frames: edged, reserved, domain, width: stageWidth, height: stageHeight });

  const box = plotBox({ width: stageWidth, height: stageHeight, margins });
  const locale = localeInput ?? lessonLocale;

  const target = cameraView({
    domain,
    width: box.innerWidth,
    height: box.innerHeight,
    frames: focusIds.flatMap((id) => framesOf(registry, id)),
    padding: FOCUS_PADDING,
  });

  const setup: SceneSetup = {
    isInScene: true,
    registry,
    camera,
    box,
    domain,
    pace,
    locale: locale ?? '',
    tone: tones,
    weightMax,
    layers: { back, wires, front },
    labels,
    scalesFor: cachedScales({ box, domain }),
  };

  useLayoutEffect(() => {
    if (registry.isPainted()) {
      camera.to(target, pace);
    } else {
      camera.jump(target);
    }
  });

  useLayoutEffect(() => registry.endDrafts(), [registry]);

  useEffect(() => {
    const frame = { stop: (): void => undefined };

    frame.stop = onFrame(() => {
      registry.markPainted();
      frame.stop();
    });

    return () => frame.stop();
  }, [registry]);

  useEffect(() => () => camera.destroy(), [camera]);

  if (locale === null) {
    return <span {...stylex.props(styles.missing)}>{labels.missingLocale}</span>;
  }

  const frame = { ...frameInput, locale };

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const boxError = sceneBoxError({ box: domain, aspect, labels });

  if (boxError !== undefined) {
    return <FigureInvalid {...frame} message={boxError} />;
  }

  if (Children.toArray(children).length === 0) {
    return (
      <FigureFrame {...frame}>
        <FigureEmpty>{emptyLabel}</FigureEmpty>
      </FigureFrame>
    );
  }

  const error = membersError({ members, focus: focusIds, box: domain, labels });

  const items =
    error === undefined
      ? members.list.flatMap((member) =>
          member.label !== undefined && member.isShown ? [{ id: member.id, label: member.label }] : [],
        )
      : [];

  function rectNow(id: string): SceneRect | undefined {
    const member = registry.member(id);
    const scales = setup.scalesFor(camera.get());

    if (member === undefined) {
      return undefined;
    }

    if (member.frame !== undefined) {
      return frameRect({ values: member.track.get(), ...scales });
    }

    return unionRect(
      member.attaches.flatMap((attached) => {
        const other = registry.member(attached);

        return other?.frame === undefined ? [] : [frameRect({ values: other.track.get(), ...scales })];
      }),
    );
  }

  /** Where the arrow keys find an object. One key press asks for many, so the spread is worked out once per press. */
  function place(id: string): SceneRect | undefined {
    if (keyboard.places === null) {
      keyboard.places = keyboardPlaces(
        items.flatMap((item) => {
          const rect = rectNow(item.id);

          return rect === undefined ? [] : [{ id: item.id, rect, order: registry.member(item.id)?.order ?? 0 }];
        }),
      );

      queueMicrotask(() => {
        keyboard.places = null;
      });
    }

    return keyboard.places.get(id) ?? rectNow(id);
  }

  return (
    <Chart
      {...link}
      items={items}
      place={place}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>}
        >
          <div ref={size.ref} {...stylex.props(styles.measure)}>
            {error !== undefined && (
              <p role="alert" {...stylex.props(styles.error)}>
                {error}
              </p>
            )}
            <div ref={scrollerRef} hidden={error !== undefined} {...stylex.props(styles.scroller)}>
              <div {...stylex.props(styles.stage(stageWidth, stageHeight))}>
                <ChartPlot
                  ref={plotRef}
                  role="group"
                  aria-label={plotLabel({
                    title: frame.title,
                    marks: labels.objects,
                    isSelectable: onSelectedChange !== undefined,
                  })}
                  aria-describedby={readoutId}
                  onFocus={(event) => setKeyboardFocused(event.currentTarget.matches(':focus-visible'))}
                  onBlur={() => setKeyboardFocused(false)}
                  {...stylex.props(styles.plot, stylex.defaultMarker())}
                >
                  <svg
                    aria-hidden
                    width={stageWidth}
                    height={stageHeight}
                    viewBox={`0 0 ${stageWidth} ${stageHeight}`}
                    {...stylex.props(styles.svg)}
                  >
                    <g ref={setBack} />
                    <g ref={setWires} />
                    <g ref={setFront} />
                  </svg>
                </ChartPlot>
                <div {...stylex.props(styles.layer)}>
                  <SceneSetupContext value={setup}>
                    <SceneMarksContext
                      value={{
                        inspected: view.inspected,
                        selected: view.selected,
                        cursor: view.cursor,
                        lit: litIds(members.list, view.inspected),
                        isKeyboardFocused,
                        focusPlot: () => plotRef.current?.focus({ preventScroll: true }),
                      }}
                    >
                      {children}
                    </SceneMarksContext>
                  </SceneSetupContext>
                </div>
              </div>
            </div>
          </div>
          <CursorInView cursor={view.cursor} isActive={isKeyboardFocused} scrollerRef={scrollerRef} place={place} />
          <ChartData
            label={`${frame.title} ${labels.objects}`}
            columns={[{ id: 'part', label: labels.objectColumn }]}
            rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
          />
        </FigureFrame>
      )}
    />
  );
}

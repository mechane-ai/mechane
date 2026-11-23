import { createChange, createViewport, definePrimitive } from '@ui-sdk/core';
import type { ChangeDetails, Viewport, ViewportReason } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import type { PartProps, PrimitiveHandle } from '@ui-sdk/react/primitive';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { PlotBox } from '../plot-layout.ts';
import type { ContinuousScale, NumericDomain } from '../scale.ts';

/** Where an explored plot looks: its pan in CSS pixels and its zoom, where 1 shows the whole domain. */
export type PlotView = Viewport;

/** Why the view moved: a drag, a pinch, a modifier and scroll, a zoom key, the reset button or an agent's call. */
export type PlotViewDetails = ChangeDetails<ViewportReason>;

export type PlotViewportOptions = {
  /** The view now. The application or the chart holds it and passes back what `onViewChange` asks for. */
  readonly view: PlotView;
  readonly onViewChange: (view: PlotView, details: PlotViewDetails) => void;
  /** False leaves every gesture to the page and the chart: scrolling scrolls, dragging draws. */
  readonly isEnabled: boolean;
  /** How far the view zooms in. It never zooms out past the whole domain. */
  readonly maxZoom?: number | undefined;
};

/** The view that shows the whole domain. */
export const WHOLE_VIEW: Readonly<PlotView> = { x: 0, y: 0, zoom: 1 };

const ZOOM_MAX = 64;
const ZOOM_STEP = 1.25;
const PERCENT = 100;

const plotViewport = definePrimitive({
  name: 'plot-viewport',
  options: { view: 'value', onViewChange: 'callback', isEnabled: 'boolean', maxZoom: 'number' },
  controlled: ['view'],
  state: (options: PlotViewportOptions) => ({ view: options.view }),
  sync: (options) => ({ view: options.view }),
  api: (context) => {
    const change = createChange(context);

    const viewport = createViewport(context, {
      key: 'view',
      surface: () => context.element('surface'),
      set: (value, details) => change('view', value, details),
      minZoom: () => 1,
      maxZoom: () => context.options().maxZoom ?? ZOOM_MAX,
      message: (zoom) => `Zoom ${Math.round(zoom * PERCENT)}%`,
    });

    function isEnabled(): boolean {
      return context.options().isEnabled;
    }

    return {
      viewport,
      /** Shows the whole domain again. */
      reset: (event?: Event) =>
        viewport.setViewport(
          WHOLE_VIEW,
          event === undefined ? { reason: 'imperative' } : { reason: 'imperative', event },
        ),
      /** Zooms in at the center of the plot. */
      zoomIn: () => viewport.zoomBy(ZOOM_STEP),
      /** Zooms out at the center of the plot. */
      zoomOut: () => viewport.zoomBy(1 / ZOOM_STEP),
      keydown(event: KeyboardEvent): void {
        if (isEnabled() && !event.defaultPrevented) {
          viewport.keydown(event);
        }
      },
      wheel(event: WheelEvent): void {
        // A plain scroll always scrolls the page. Only a pinch, or Control or Command with a scroll, zooms.
        if (isEnabled() && (event.ctrlKey || event.metaKey)) {
          viewport.wheel(event);
        }
      },
      pointerdown(event: PointerEvent): void {
        // Shift and a drag is left to the chart, which draws a range with it.
        if (isEnabled() && !event.shiftKey) {
          viewport.pointerdown(event);
        }
      },
    };
  },
  slots: (slot) => ({
    root: slot({ on: { keydown: (event, { api }) => api.keydown(event) } }),
    surface: slot({
      on: { wheel: (event, { api }) => api.wheel(event), pointerdown: (event, { api }) => api.pointerdown(event) },
    }),
  }),
  agent: { actions: ['zoomIn', 'zoomOut', 'reset'] },
});

const ViewportContext = createContext<PrimitiveHandle<typeof plotViewport> | null>(null);

export type PlotViewportRootProps = PlotViewportOptions & Omit<PartProps<'div'>, 'id'>;

/**
 * Pans and zooms a plot with the UI SDK viewport. A drag pans, a pinch or Control or Command with a scroll zooms, and
 * `+`, `−` and `0` zoom from the keyboard while the plot has focus. Wrap the plot in it and put `PlotViewportSurface`
 * over the drawing area, and the caller holds `view` so a reset button sets it back to `WHOLE_VIEW`.
 */
export function PlotViewportRoot({
  view,
  onViewChange,
  isEnabled,
  maxZoom,
  ...props
}: PlotViewportRootProps): ReactNode {
  const viewport = usePrimitive(plotViewport, { view, onViewChange, isEnabled, maxZoom });
  const root = usePart(viewport, 'root', {}, props, 'div');

  return <ViewportContext value={viewport}>{root}</ViewportContext>;
}

/** The area that takes the pan and zoom gestures: the plot's drawing area, inside its axes. */
export function PlotViewportSurface(props: Omit<PartProps<'div'>, 'id'>): ReactNode {
  const viewport = use(ViewportContext);

  if (viewport === null) {
    throw new Error('PlotViewportSurface must be rendered inside PlotViewportRoot.');
  }

  return usePart(viewport, 'surface', {}, props, 'div');
}

/** The part of each axis's domain an explored plot shows, from the scales that show the whole domain. */
export function visibleDomains({
  view,
  box,
  x,
  y,
}: {
  readonly view: PlotView;
  readonly box: PlotBox;
  readonly x: ContinuousScale;
  readonly y: ContinuousScale;
}): { readonly x: NumericDomain; readonly y: NumericDomain } {
  function across(screen: number): number {
    return (screen - view.x) / view.zoom;
  }

  function down(screen: number): number {
    return (screen - view.y) / view.zoom;
  }

  return {
    x: [x.valueAt(box.left + across(0)), x.valueAt(box.left + across(box.innerWidth))],
    y: [y.valueAt(box.top + down(box.innerHeight)), y.valueAt(box.top + down(0))],
  };
}

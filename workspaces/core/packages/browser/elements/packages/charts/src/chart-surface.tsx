import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ReactNode } from 'react';

const activationKeys: ReadonlySet<string> = new Set([' ', 'Enter']);

type ChartItem = { readonly id: string; readonly label: string };

type NavigationIndices = Readonly<Record<string, number | undefined>>;

type NavigationPosition = { readonly index: number; readonly last: number };

function listIndices({
  index,
  last,
  allowVerticalNavigation,
}: NavigationPosition & { readonly allowVerticalNavigation: boolean }): NavigationIndices {
  const previous = Math.max(0, index - 1);
  const next = Math.min(last, index + 1);

  return {
    Home: 0,
    End: last,
    ArrowLeft: previous,
    ArrowRight: next,
    ArrowUp: allowVerticalNavigation ? previous : undefined,
    ArrowDown: allowVerticalNavigation ? next : undefined,
  };
}

function gridIndices({
  index,
  last,
  columnCount,
}: NavigationPosition & { readonly columnCount: number }): NavigationIndices {
  const current = Math.max(0, index);
  const rowStart = current - (current % columnCount);
  const rowEnd = Math.min(last, rowStart + columnCount - 1);
  const above = current - columnCount;
  const below = current + columnCount;

  return {
    Home: rowStart,
    End: rowEnd,
    ArrowLeft: Math.max(rowStart, current - 1),
    ArrowRight: Math.min(rowEnd, current + 1),
    ArrowUp: above < 0 ? current : above,
    ArrowDown: below > last ? current : below,
  };
}

export type ChartControls = {
  readonly items: ReadonlyArray<ChartItem>;
  readonly cursor: string | undefined;
  readonly inspected: string | undefined;
  readonly readout: string | undefined;
  readonly selected?: string | undefined;
  readonly allowVerticalNavigation?: boolean;
  /** Arranges the items row by row in a grid of this width. Up and Down change rows; Home and End stay in the row. */
  readonly columnCount?: number | undefined;
  readonly onInspect: (id: string) => void;
  readonly onDismiss: () => void;
  readonly onSelect?: ((id: string) => void) | undefined;
};

function chartState({ controls }: { controls: ChartControls }) {
  return { value: controls.inspected ?? null, readout: controls.readout ?? null, selected: controls.selected ?? null };
}

const chartInspection = definePrimitive({
  name: 'chart-inspection',
  options: { controls: 'value' },
  state: chartState,
  sync: chartState,
  controlled: ['value', 'readout', 'selected'],
  api: ({ options }) => {
    function inspect(id: string): boolean {
      const { items, onInspect } = options().controls;

      if (!items.some((item) => item.id === id)) {
        return false;
      }

      onInspect(id);

      return true;
    }

    function select(id: string): boolean {
      const { items, onSelect } = options().controls;

      if (onSelect === undefined || !items.some((item) => item.id === id)) {
        return false;
      }

      onSelect(id);

      return true;
    }

    function onKeyDown(event: KeyboardEvent): void {
      const { items, cursor, allowVerticalNavigation, onDismiss } = options().controls;

      const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

      if (event.defaultPrevented || hasModifier || items.length === 0) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();

        return;
      }

      if (activationKeys.has(event.key)) {
        if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea') !== null) {
          return;
        }

        if (cursor !== undefined && select(cursor)) {
          event.preventDefault();
        }

        return;
      }

      const index = items.findIndex((item) => item.id === cursor);
      const last = items.length - 1;
      const { columnCount } = options().controls;

      const indices =
        columnCount === undefined || columnCount < 1
          ? listIndices({ index, last, allowVerticalNavigation: allowVerticalNavigation === true })
          : gridIndices({ index, last, columnCount });

      const next = indices[event.key];
      const item = next === undefined ? undefined : items[next];

      if (item !== undefined) {
        event.preventDefault();
        options().controls.onInspect(item.id);
      }
    }

    return {
      setValue: inspect,
      get selectItem() {
        return options().controls.onSelect === undefined ? undefined : select;
      },
      clear: () => options().controls.onDismiss(),
      items: () => options().controls.items.map(({ id, label }) => ({ value: id, label })),
      onKeyDown,
    };
  },
  slots: (slot) => ({ root: slot({ on: { keydown: (event, { api }) => api.onKeyDown(event) } }) }),
  agent: { items: (api) => api.items(), closed: true },
});

type ChartRoot<Tag extends 'div' | 'p' | 'svg'> = (
  props: Omit<PartProps<Tag>, 'id' | 'controls'> & { id?: string; controls: ChartControls },
) => ReactNode;

export const ChartSurface: ChartRoot<'div'> = createParts(chartInspection, { root: 'div' }).Root;
export const ChartTextSurface: ChartRoot<'p'> = createParts(chartInspection, { root: 'p' }).Root;
export const ChartSvgSurface: ChartRoot<'svg'> = createParts(chartInspection, { root: 'svg' }).Root;

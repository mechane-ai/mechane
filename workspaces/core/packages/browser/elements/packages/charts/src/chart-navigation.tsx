import { useId, useState } from 'react';
import type { HTMLAttributes } from 'react';
import type { ChartSelection } from './chart-frame.tsx';
import type { ChartControls } from './chart-surface.tsx';

type ChartNavigationItem = { readonly id: string; readonly label: string };

type ChartNavigationInput = {
  readonly title: string;
  readonly items: ReadonlyArray<ChartNavigationItem>;
  readonly selection: ChartSelection | undefined;
  readonly columnCount?: number | undefined;
};

export function useChartNavigation({ title, items, selection, columnCount }: ChartNavigationInput) {
  const id = useId();
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [isInspecting, setInspecting] = useState(false);

  const index = Math.max(
    0,
    items.findIndex((item) => item.id === (cursor ?? selection?.selectedId)),
  );

  const active = items[index];

  function inspect(itemId: string): void {
    setCursor(itemId);
    setInspecting(true);
  }

  const props = {
    'controls': {
      items,
      cursor: active?.id,
      inspected: isInspecting ? active?.id : undefined,
      readout: isInspecting ? active?.label : undefined,
      selected: items.find((item) => item.id === selection?.selectedId)?.id,
      allowVerticalNavigation: true,
      columnCount,
      onInspect: inspect,
      onDismiss: () => setInspecting(false),
      onSelect: selection?.onSelect,
    },
    'role': 'group',
    'tabIndex': items.length > 0 ? 0 : undefined,
    'aria-label': `${title}. Use arrow keys to inspect.${selection === undefined ? '' : ' Press Enter to select.'}`,
    'aria-describedby': id,
    'onFocus': () => setInspecting(true),
    'onBlur': (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setInspecting(false);
      }
    },
    'onPointerLeave': (event) => {
      if (!event.currentTarget.contains(document.activeElement)) {
        setInspecting(false);
      }
    },
  } satisfies HTMLAttributes<HTMLElement> & { controls: ChartControls };

  return { id, props, activeId: active?.id, label: isInspecting ? active?.label : undefined, inspect };
}

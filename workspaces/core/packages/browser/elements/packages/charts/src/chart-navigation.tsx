import { useId, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent } from 'react';
import type { ChartSelection } from './chart-frame.tsx';

const ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

type ChartNavigationItem = { readonly id: string; readonly label: string };

type ChartNavigationInput = {
  readonly title: string;
  readonly items: ReadonlyArray<ChartNavigationItem>;
  readonly selection: ChartSelection | undefined;
};

export function useChartNavigation({ title, items, selection }: ChartNavigationInput) {
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

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

    if (event.defaultPrevented || hasModifier || items.length === 0) {
      return;
    }

    const lastIndex = items.length - 1;

    const steps: Readonly<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowDown: 1,
      Home: -index,
      End: lastIndex - index,
    };

    const step = steps[event.key];

    if (step !== undefined) {
      event.preventDefault();

      const item = items[Math.max(0, Math.min(lastIndex, index + step))];

      if (item !== undefined) {
        inspect(item.id);
      }
    } else if (ACTIVATION_KEYS.has(event.key) && selection !== undefined && active !== undefined) {
      event.preventDefault();
      selection.onSelect(active.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setInspecting(false);
    }
  }

  const props: HTMLAttributes<HTMLElement> = {
    'role': 'group',
    'tabIndex': items.length > 0 ? 0 : undefined,
    'aria-label': `${title}. Use arrow keys to inspect.${selection === undefined ? '' : ' Press Enter to select.'}`,
    'aria-describedby': id,
    onKeyDown,
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
  };

  return { id, props, activeId: active?.id, label: isInspecting ? active?.label : undefined, inspect };
}

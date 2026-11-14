import * as stylex from '@stylexjs/stylex';
import { ListFilter, Search, X } from 'lucide-react';
import { Children, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../overlays/src/index.ts';
import { FilterChips } from './collection-controls.tsx';
import { CollectionFilters } from './collection-filters.tsx';
import type { CollectionFilter } from './collection-filters.tsx';

const styles = stylex.create({
  controls: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minWidth: 0,
    maxWidth: '100%',
  },
  find: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    width: 'clamp(120px, 40vw, 240px)',
    maxWidth: '100%',
  },
  input: { minWidth: 0, flex: 1 },
  contents: { display: 'contents' },
  popup: { width: 320, maxWidth: 'calc(100vw - 32px)' },
});

export type CollectionSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly label?: string;
  readonly placeholder?: string;
};

export type CollectionControlsProps = {
  readonly search?: CollectionSearch;
  readonly filters?: ReadonlyArray<CollectionFilter>;
  readonly filterContent?: (close: () => void) => ReactNode;
  readonly chips?: ReadonlyArray<{ readonly id: string; readonly label: string; readonly onRemove: () => void }>;
  readonly viewActions?: ReactNode;
  readonly display?: ReactNode;
};

export function useCollectionControls({
  search,
  filters = [],
  filterContent,
  chips = [],
  viewActions,
  display,
  isPlaceholder = false,
  isReady,
}: CollectionControlsProps & { isPlaceholder?: boolean; isReady: boolean }) {
  const [isFinding, setFinding] = useState(false);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const collectionControls = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const isUnavailable = isPlaceholder || !isReady;
  const isOpen = search !== undefined && (isFinding || search.value.length > 0);

  useLayoutEffect(() => {
    if (isFinding && !isPlaceholder && isReady) {
      input.current?.focus();
      input.current?.select();
    }
  }, [isFinding, isPlaceholder, isReady]);

  function focusControl() {
    (trigger.current ?? collectionControls.current?.querySelector<HTMLButtonElement>('button'))?.focus();
  }

  function openSearch() {
    if (search !== undefined && !isPlaceholder && isReady) {
      input.current?.focus();
      input.current?.select();
      setFinding(true);
    }
  }

  function close() {
    search?.onChange('');
    setFinding(false);
    focusControl();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isOpen || event.defaultPrevented || event.key !== 'Escape') {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    if (
      event.target.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-native-find], input:not([data-view-find]), textarea, select',
      ) !== null
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    close();
  }

  const activeChips = filters
    .filter((group) => group.value !== group.defaultValue)
    .map((group) => ({
      id: `filter:${group.id}`,
      label: group.options.find((option) => option.value === group.value)?.label ?? group.value,
      onRemove: () => group.onChange(group.defaultValue),
    }));

  for (const chip of chips) {
    activeChips.push({ ...chip, id: `chip:${chip.id}` });
  }

  const hasFilters = filterContent !== undefined || filters.length > 0;
  const hasExtras = Children.toArray([viewActions, display]).length > 0;
  const hasActions = search !== undefined || hasFilters || hasExtras;
  const searchLabel = search?.label ?? 'Search this view';
  const searchPlaceholder = search?.placeholder ?? 'Find in view…';

  const actions = hasActions ? (
    <div ref={collectionControls} aria-hidden={isUnavailable} inert={isUnavailable} {...stylex.props(styles.controls)}>
      {search !== undefined && (
        <IconButton
          ref={trigger}
          type="button"
          disabled={isPlaceholder}
          aria-label="Find in view"
          title="Find in view"
          data-view-find-trigger
          aria-expanded={isOpen}
          onClick={openSearch}
        >
          <Search size={14} aria-hidden />
        </IconButton>
      )}
      {isOpen && (
        <div {...stylex.props(styles.find)}>
          <Input
            ref={input}
            type="search"
            disabled={isPlaceholder}
            data-view-find
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            onKeyDown={(event) => {
              const shouldSubmit = event.key === 'Enter' && search.onSubmit !== undefined;

              if (shouldSubmit) {
                event.preventDefault();
                search.onSubmit();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            xstyle={styles.input}
          />
          <IconButton
            type="button"
            variant="ghost"
            data-view-find-close
            aria-label="Close search"
            title="Close search (Esc)"
            onClick={close}
          >
            <X size={14} aria-hidden />
          </IconButton>
        </div>
      )}
      {filterContent === undefined ? (
        filters.length > 0 ? (
          <CollectionFilters groups={filters} />
        ) : null
      ) : (
        <Popover.Root open={isFilterOpen} onOpenChange={setFilterOpen}>
          <Popover.Trigger render={<IconButton aria-label="Filters" title="Filters" />}>
            <ListFilter size={14} aria-hidden />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner align="end">
              <Popover.Popup {...stylex.props(styles.popup)}>
                <Popover.Title>Filters</Popover.Title>
                {filterContent(() => setFilterOpen(false))}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
      {viewActions}
      {display}
    </div>
  ) : undefined;

  return {
    openSearch,
    onKeyDown,
    actions,
    chips: activeChips.length > 0 && (
      <div aria-hidden={isUnavailable} inert={isUnavailable} {...stylex.props(styles.contents)}>
        <FilterChips
          filters={activeChips}
          onRemove={(id) => {
            focusControl();
            activeChips.find((chip) => chip.id === id)?.onRemove();
          }}
        />
      </div>
    ),
  };
}

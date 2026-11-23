import * as stylex from '@stylexjs/stylex';
import { dispatch } from '@ui-sdk/core';
import { ToolbarButton, ToolbarInput } from '@ui-sdk/react/toolbar';
import { ListFilter, Search, X } from 'lucide-react';
import { Children, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { IconButton } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../overlays/src/index.ts';
import { FilterChips } from './collection-controls.tsx';
import type { FilterRemoveDetails } from './collection-controls.tsx';
import { CollectionFilters } from './collection-filters.tsx';
import type { CollectionFilter } from './collection-filters.tsx';
import { ControlToolbar } from './control-toolbar.tsx';
import { QueryControls } from './query-controls.tsx';
import type { CollectionSearch } from './query-controls.tsx';

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

export type CollectionControlsProps = {
  readonly label?: string;
  readonly search?: CollectionSearch;
  readonly filters?: ReadonlyArray<CollectionFilter>;
  readonly filterContent?: (close: () => void) => ReactNode;
  readonly chips?: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly onRemove: (details: FilterRemoveDetails) => void;
  }>;
  readonly viewActions?: ReactNode;
  readonly display?: ReactNode;
};

export function useCollectionControls({
  label = 'Collection controls',
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
  const selections = useMemo(() => Object.fromEntries(filters.map((group) => [group.id, group.value])), [filters]);
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

  function close(reason: 'clear-press' | 'escape-key', event: Event) {
    if (search !== undefined) {
      dispatch({ options: () => search }, 'onChange', '', { reason, event });
    }

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
    close('escape-key', event.nativeEvent);
  }

  const activeChips = filters
    .filter((group) => group.value !== group.defaultValue)
    .map((group) => ({
      id: `filter:${group.id}`,
      label: group.options.find((option) => option.value === group.value)?.label ?? group.value,
      onRemove: (details: FilterRemoveDetails) => group.onChange(group.defaultValue, details),
    }));

  for (const chip of chips) {
    activeChips.push({ ...chip, id: `chip:${chip.id}` });
  }

  const hasFilters = filterContent !== undefined || filters.length > 0;
  const hasExtras = Children.toArray([viewActions, display]).length > 0;
  const hasActions = search !== undefined || hasFilters || hasExtras;
  const searchLabel = search?.label ?? 'Search this view';
  const searchPlaceholder = search?.placeholder ?? 'Find in view…';

  // The controls are one UI SDK toolbar, or a group of the collection toolbar around them: one Tab stop either way.
  const actions = hasActions ? (
    <ControlToolbar
      aria-label={label}
      render={
        <QueryControls
          search={search}
          groups={filters}
          selections={selections}
          isDisabled={isUnavailable}
          ref={collectionControls}
          aria-hidden={isUnavailable}
          inert={isUnavailable}
          {...stylex.props(styles.controls)}
        />
      }
    >
      {search !== undefined && (
        <ToolbarButton
          disabled={isPlaceholder}
          render={
            <IconButton
              ref={trigger}
              type="button"
              aria-label="Find in view"
              title="Find in view"
              data-view-find-trigger
              aria-expanded={isOpen}
              onClick={openSearch}
            />
          }
        >
          <Search size={14} aria-hidden />
        </ToolbarButton>
      )}
      {isOpen && (
        <div {...stylex.props(styles.find)}>
          <ToolbarInput
            disabled={isPlaceholder}
            render={
              <Input
                ref={input}
                type="search"
                data-view-find
                aria-label={searchLabel}
                placeholder={searchPlaceholder}
                value={search.value}
                onValueChange={search.onChange}
                onKeyDown={(event) => {
                  const shouldSubmit = event.key === 'Enter' && search.onSubmit !== undefined;

                  if (shouldSubmit) {
                    event.preventDefault();
                    dispatch({ options: () => search }, 'onSubmit', search.value, {
                      reason: 'enter-key',
                      event: event.nativeEvent,
                    });
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    close('escape-key', event.nativeEvent);
                  }
                }}
                xstyle={styles.input}
              />
            }
          />
          <ToolbarButton
            render={
              <IconButton
                type="button"
                variant="ghost"
                data-view-find-close
                aria-label="Close search"
                title="Close search (Esc)"
                onClick={(event) => close('clear-press', event.nativeEvent)}
              />
            }
          >
            <X size={14} aria-hidden />
          </ToolbarButton>
        </div>
      )}
      {filterContent === undefined ? (
        filters.length > 0 ? (
          <CollectionFilters groups={filters} />
        ) : null
      ) : (
        <Popover.Root open={isFilterOpen} onOpenChange={setFilterOpen}>
          <Popover.Trigger render={<ToolbarButton render={<IconButton aria-label="Filters" title="Filters" />} />}>
            <ListFilter size={14} aria-hidden />
          </Popover.Trigger>
          <Popover.Popup align="end" {...stylex.props(styles.popup)}>
            <Popover.Title>Filters</Popover.Title>
            {filterContent(() => setFilterOpen(false))}
          </Popover.Popup>
        </Popover.Root>
      )}
      {viewActions}
      {display}
    </ControlToolbar>
  ) : undefined;

  return {
    openSearch,
    onKeyDown,
    actions,
    chips: activeChips.length > 0 && (
      <div aria-hidden={isUnavailable} inert={isUnavailable} {...stylex.props(styles.contents)}>
        <FilterChips
          filters={activeChips}
          onRemove={(id, details) => {
            focusControl();
            activeChips.find((chip) => chip.id === id)?.onRemove(details);
          }}
        />
      </div>
    ),
  };
}

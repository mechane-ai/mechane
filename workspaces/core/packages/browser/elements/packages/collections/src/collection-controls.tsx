import * as stylex from '@stylexjs/stylex';
import { dispatch } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { ToolbarButton } from '@ui-sdk/react/toolbar';
import { ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { Button, IconButton, Text } from '../../core/src/index.ts';
import { Checkbox } from '../../forms/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../overlays/src/index.ts';
import { ControlToolbar, useToolbarButton } from './control-toolbar.tsx';

const styles = stylex.create({
  toolbar: {
    'gap': spacing.sm,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    ':empty': { display: 'none' },
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minWidth: 0,
    marginInlineStart: 'auto',
  },
  filters: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minWidth: 0 },
  filter: {
    'position': 'relative',
    'boxSizing': 'border-box',
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.xs,
    'height': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInlineStart': spacing.sm,
    'borderRadius': radii.sm,
    'minWidth': 0,
    'maxWidth': '100%',
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.line,
      borderRadius: 'inherit',
      pointerEvents: 'none',
    },
  },
  filterLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  remove: { flexShrink: 0 },
  choices: { display: 'grid', gap: spacing.md, minWidth: 180 },
  choice: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    color: colors.ink,
    fontSize: typography.bodySize,
    fontFamily: typography.fontFamily,
    lineHeight: typography.bodyLineHeight,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
    minWidth: 0,
  },
});

export type CollectionToolbarProps = {
  readonly label: string;
  readonly children?: ReactNode;
  readonly actions?: ReactNode;
};

/** The control row above a collection, on the UI SDK toolbar: filter chips and actions share one Tab stop. */
export function CollectionToolbar({ label, children, actions }: CollectionToolbarProps): ReactNode {
  const hasChildren = Children.toArray(children).length > 0;
  const hasActions = Children.toArray(actions).length > 0;

  if (!hasChildren && !hasActions) {
    return null;
  }

  return (
    <ControlToolbar aria-label={label} {...stylex.props(headerStyles.row, headerStyles.blockEnd, styles.toolbar)}>
      {children}
      {hasActions && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </ControlToolbar>
  );
}

export type FilterChip = { readonly id: string; readonly label: string };

export type FilterRemoveDetails = ChangeDetails<'remove-press'>;

export type FilterChipsProps = {
  readonly filters: ReadonlyArray<FilterChip>;
  readonly onRemove: (id: string, details: FilterRemoveDetails) => void;
  readonly label?: string;
};

/** The applied filters, each with a remove button. The buttons share one Tab stop on the UI SDK toolbar. */
export function FilterChips({ filters, onRemove, label = 'Applied filters' }: FilterChipsProps): ReactNode {
  if (filters.length === 0) {
    return null;
  }

  return (
    <ControlToolbar aria-label={label} {...stylex.props(styles.filters)}>
      {filters.map((filter) => (
        <span key={filter.id} {...stylex.props(styles.filter)}>
          <span title={filter.label} {...stylex.props(styles.filterLabel)}>
            {filter.label}
          </span>
          <ToolbarButton
            render={<IconButton aria-label={`Remove ${filter.label}`} variant="ghost" xstyle={styles.remove} />}
            onClick={(event) => {
              dispatch({ options: () => ({ onRemove }) }, 'onRemove', filter.id, {
                reason: 'remove-press',
                event: event.nativeEvent,
              });
            }}
          >
            <X size={14} aria-hidden="true" />
          </ToolbarButton>
        </span>
      ))}
    </ControlToolbar>
  );
}

export type DisplayOption = {
  readonly id: string;
  readonly label: string;
  readonly isChecked: boolean;
  readonly isRequired?: boolean;
};

export type DisplayOptionsProps = {
  readonly options: ReadonlyArray<DisplayOption>;
  readonly onChange: (id: string, checked: boolean) => void;
  readonly onReset?: () => void;
  readonly label?: string;
};

export function DisplayOptions({
  options,
  onChange,
  onReset,
  label = 'Display options',
}: DisplayOptionsProps): ReactNode {
  const trigger = useToolbarButton(<IconButton aria-label={label} title={label} />);

  return (
    <Popover.Root>
      <Popover.Trigger render={trigger}>
        <Settings2 size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Popup align="end">
        <Popover.Title>Display</Popover.Title>
        <div {...stylex.props(styles.choices)}>
          {options.map((option) => (
            <label key={option.id} {...stylex.props(styles.choice)}>
              <Checkbox.Root
                checked={option.isChecked}
                onCheckedChange={(checked) => onChange(option.id, checked)}
                disabled={option.isRequired === true}
              >
                <Checkbox.Indicator />
              </Checkbox.Root>
              {option.label}
            </label>
          ))}
          {onReset !== undefined && (
            <Button type="button" variant="ghost" onClick={onReset}>
              Reset defaults
            </Button>
          )}
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
}

export type CollectionPaginationProps = {
  readonly label?: string;
  readonly description: string;
  readonly previous: { readonly disabled: boolean; readonly onClick: () => void };
  readonly next: { readonly disabled: boolean; readonly onClick: () => void };
};

export function CollectionPagination({ label, description, previous, next }: CollectionPaginationProps): ReactNode {
  return (
    <nav aria-label={label === undefined ? 'Pagination' : `${label} pagination`} {...stylex.props(styles.pagination)}>
      <Text>{description}</Text>
      <div {...stylex.props(styles.actions)}>
        <Button
          variant="outline"
          aria-label={label === undefined ? undefined : `Previous page of ${label}`}
          disabled={previous.disabled}
          onClick={previous.onClick}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="outline"
          aria-label={label === undefined ? undefined : `Next page of ${label}`}
          disabled={next.disabled}
          onClick={next.onClick}
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

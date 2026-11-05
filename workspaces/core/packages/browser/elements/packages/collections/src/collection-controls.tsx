import * as stylex from '@stylexjs/stylex';
import { ChevronLeft, ChevronRight, Columns3, X } from 'lucide-react';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { Button, IconButton, Text } from '../../core/src/index.ts';
import { Checkbox } from '../../forms/src/index.ts';
import {
  colors,
  conditions,
  controls,
  pageGeometry,
  radii,
  spacing,
  typography,
} from '../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../overlays/src/index.ts';

const styles = stylex.create({
  toolbar: {
    'boxSizing': 'border-box',
    'display': 'flex',
    'alignItems': 'center',
    'flexWrap': 'wrap',
    'minWidth': 0,
    'minHeight': pageGeometry.toolbarHeight,
    'gap': spacing.sm,
    'paddingInline': pageGeometry.inset,
    'paddingBlock': {
      default: `calc((${pageGeometry.toolbarHeight} - ${controls.height} - 1px) / 2)`,
      [conditions.coarsePointer]: `calc((${pageGeometry.toolbarHeight} - ${controls.coarseTarget} - 1px) / 2)`,
    },
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
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

export function CollectionToolbar({ label, children, actions }: CollectionToolbarProps): ReactNode {
  const hasChildren = Children.toArray(children).length > 0;
  const hasActions = Children.toArray(actions).length > 0;

  if (!hasChildren && !hasActions) {
    return null;
  }

  return (
    <div role="group" aria-label={label} {...stylex.props(styles.toolbar)}>
      {children}
      {hasActions && <div {...stylex.props(styles.actions)}>{actions}</div>}
    </div>
  );
}

export type FilterChip = { readonly id: string; readonly label: string };

export type FilterChipsProps = {
  readonly filters: ReadonlyArray<FilterChip>;
  readonly onRemove: (id: string) => void;
  readonly label?: string;
};

export function FilterChips({ filters, onRemove, label = 'Applied filters' }: FilterChipsProps): ReactNode {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div role="group" aria-label={label} {...stylex.props(styles.filters)}>
      {filters.map((filter) => (
        <span key={filter.id} {...stylex.props(styles.filter)}>
          <span title={filter.label} {...stylex.props(styles.filterLabel)}>
            {filter.label}
          </span>
          <IconButton
            aria-label={`Remove ${filter.label}`}
            variant="ghost"
            onClick={() => onRemove(filter.id)}
            xstyle={styles.remove}
          >
            <X size={14} aria-hidden="true" />
          </IconButton>
        </span>
      ))}
    </div>
  );
}

export type ColumnChoice = {
  readonly id: string;
  readonly label: string;
  readonly visible: boolean;
  readonly required?: boolean;
};

export type ColumnControlsProps = {
  readonly columns: ReadonlyArray<ColumnChoice>;
  readonly onVisibilityChange: (columnId: string, visible: boolean) => void;
  readonly label?: string;
};

export function ColumnControls({ columns, onVisibilityChange, label = 'Columns' }: ColumnControlsProps): ReactNode {
  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" />}>
        <Columns3 size={16} aria-hidden="true" />
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end">
          <Popover.Popup aria-label={label}>
            <div {...stylex.props(styles.choices)}>
              {columns.map((column) => (
                <label key={column.id} {...stylex.props(styles.choice)}>
                  <Checkbox.Root
                    checked={column.visible}
                    onCheckedChange={(visible) => onVisibilityChange(column.id, visible)}
                    disabled={column.required}
                  >
                    <Checkbox.Indicator />
                  </Checkbox.Root>
                  {column.label}
                </label>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export type CollectionPaginationProps = {
  readonly description: string;
  readonly previous: { readonly disabled: boolean; readonly onClick: () => void };
  readonly next: { readonly disabled: boolean; readonly onClick: () => void };
};

export function CollectionPagination({ description, previous, next }: CollectionPaginationProps): ReactNode {
  return (
    <nav aria-label="Pagination" {...stylex.props(styles.pagination)}>
      <Text>{description}</Text>
      <div {...stylex.props(styles.actions)}>
        <Button variant="outline" disabled={previous.disabled} onClick={previous.onClick}>
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </Button>
        <Button variant="outline" disabled={next.disabled} onClick={next.onClick}>
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

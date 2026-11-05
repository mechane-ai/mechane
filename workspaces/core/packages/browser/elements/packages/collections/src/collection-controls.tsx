import * as stylex from '@stylexjs/stylex';
import { ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { Button, IconButton, Text } from '../../core/src/index.ts';
import { Checkbox } from '../../forms/src/index.ts';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, pageGeometry, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
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
  return (
    <Popover.Root>
      <Popover.Trigger render={<IconButton aria-label={label} title={label} />}>
        <Settings2 size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end">
          <Popover.Popup>
            <Popover.Title>Display</Popover.Title>
            <div {...stylex.props(styles.choices)}>
              {options.map((option) => (
                <label key={option.id} {...stylex.props(styles.choice)}>
                  <Checkbox.Root
                    checked={option.isChecked}
                    onCheckedChange={(checked) => onChange(option.id, checked)}
                    disabled={option.isRequired}
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

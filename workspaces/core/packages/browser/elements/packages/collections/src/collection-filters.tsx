import * as stylex from '@stylexjs/stylex';
import { ChevronRight, CircleDashed, ListFilter } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { IconButton, Muted } from '../../core/src/index.ts';
import type { Badge } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { Menu } from '../../overlays/src/index.ts';

const styles = stylex.create({
  label: { paddingBlock: spacing.xs, paddingInline: spacing.sm },
  optionLabel: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  search: { width: '100%', marginBlockEnd: spacing.xs },
  selected: {
    maxWidth: 100,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  icon: { display: 'flex', color: colors.muted },
  positive: { color: colors.accent },
  warning: { color: colors.warning },
  negative: { color: colors.danger },
});

export type FilterOption = {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode;
  tone?: ComponentProps<typeof Badge>['tone'];
};

const toneStyles = {
  positive: styles.positive,
  negative: styles.negative,
  warning: styles.warning,
  neutral: undefined,
};

const EDITING_KEYS: ReadonlySet<string> = new Set(['Home', 'End', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete']);

function OptionIcon({ option }: { option: FilterOption }) {
  return (
    <span {...stylex.props(styles.icon, toneStyles[option.tone ?? 'neutral'])}>
      {option.icon ?? <CircleDashed size={14} aria-hidden />}
    </span>
  );
}

export type CollectionFilter = {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly value: string;
  readonly defaultValue: string;
  readonly options: ReadonlyArray<FilterOption>;
  readonly onChange: (value: string) => void;
};

export function CollectionFilters({ groups }: { groups: ReadonlyArray<CollectionFilter> }) {
  const [query, setQuery] = useState('');
  const visible = groups.filter((group) => group.label.toLowerCase().includes(query.toLowerCase()));

  const label =
    groups.length === 1 && groups[0] !== undefined ? `Filter by ${groups[0].label.toLowerCase()}` : 'Filters';

  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (!open) {
          setQuery('');
        }
      }}
    >
      <Menu.Trigger render={<IconButton aria-label={label} title="Filters" />}>
        <ListFilter size={14} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end">
          <Menu.Popup>
            <MenuSearch label="Find a filter" value={query} onChange={setQuery} />
            {visible.map((group) => (
              <FilterSubmenu key={group.id} group={group} />
            ))}
            {visible.length === 0 && (
              <div {...stylex.props(styles.label)}>
                <Muted>No filters found</Muted>
              </div>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MenuSearch({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <Input
      type="search"
      aria-label={label}
      placeholder="Filter…"
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key.length === 1 || EDITING_KEYS.has(event.key)) {
          event.stopPropagation();
        }
      }}
      xstyle={styles.search}
    />
  );
}

function FilterSubmenu({ group }: { group: CollectionFilter }) {
  const [query, setQuery] = useState('');

  const visible = group.options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <Menu.SubmenuRoot
      onOpenChange={(open) => {
        if (!open) {
          setQuery('');
        }
      }}
    >
      <Menu.SubmenuTrigger>
        {group.icon ?? <ListFilter size={14} aria-hidden />}
        <span {...stylex.props(styles.optionLabel)}>{group.label}</span>
        <span {...stylex.props(styles.selected)}>
          {group.options.find((option) => option.value === group.value)?.label}
        </span>
        <ChevronRight size={14} aria-hidden />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner align="start">
          <Menu.Popup aria-label={group.label}>
            <MenuSearch label={`Find ${group.label.toLowerCase()}`} value={query} onChange={setQuery} />
            <Menu.RadioGroup value={group.value} onValueChange={group.onChange}>
              {visible.map((option) => (
                <Menu.RadioItem key={option.value} value={option.value} closeOnClick>
                  <OptionIcon option={option} />
                  <span {...stylex.props(styles.optionLabel)}>{option.label}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
            {visible.length === 0 && (
              <div {...stylex.props(styles.label)}>
                <Muted>No options found</Muted>
              </div>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

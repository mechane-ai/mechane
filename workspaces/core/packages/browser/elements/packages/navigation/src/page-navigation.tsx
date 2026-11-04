import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, conditions, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  navigation: {
    'display': 'flex',
    'gap': spacing.xl,
    'minWidth': 0,
    'overflowX': 'auto',
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'fontFamily': typography.fontFamily,
    'fontSize': typography.inputSize,
    'lineHeight': typography.bodyLineHeight,
    'WebkitFontSmoothing': 'antialiased',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  embedded: { borderBottomWidth: 0 },
  link: {
    'boxSizing': 'border-box',
    'display': 'inline-flex',
    'alignItems': 'center',
    'flexShrink': 0,
    'minHeight': controls.coarseTarget,
    'paddingBlock': spacing.sm,
    'borderBottomWidth': 2,
    'borderBottomStyle': 'solid',
    'borderBottomColor': 'transparent',
    'textDecorationLine': 'none',
    'whiteSpace': 'nowrap',
    'color': colors.muted,
    ':hover': { color: { [conditions.hoverPointer]: colors.ink } },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  selected: { color: colors.ink, borderBottomColor: colors.ink },
});

export type PageNavigationItem<ItemId extends string = string> = {
  readonly id: ItemId;
  readonly label: string;
  readonly href: string;
};

export type PageNavigationProps<ItemId extends string = string> = {
  readonly items: ReadonlyArray<PageNavigationItem<ItemId>>;
  readonly selectedId: ItemId;
  readonly onNavigate?: (id: ItemId) => void;
  readonly label?: string;
  readonly embedded?: boolean;
};

export function PageNavigation<ItemId extends string>({
  items,
  selectedId,
  onNavigate,
  label = 'Page sections',
  embedded = false,
}: PageNavigationProps<ItemId>): ReactNode {
  return (
    <nav aria-label={label} tabIndex={0} {...stylex.props(styles.navigation, embedded && styles.embedded)}>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.id === selectedId ? 'page' : undefined}
          {...stylex.props(styles.link, item.id === selectedId && styles.selected)}
          onClick={(event) => {
            if (onNavigate === undefined || event.defaultPrevented || event.button !== 0) {
              return;
            }

            const command = event.metaKey || event.ctrlKey;
            const alternate = event.shiftKey || event.altKey;

            if (command || alternate) {
              return;
            }

            event.preventDefault();
            onNavigate(item.id);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

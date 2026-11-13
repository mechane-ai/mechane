import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, spacing } from '../../foundations/src/tokens.stylex.ts';
import { tabStyles } from './tab-styles.ts';

const styles = stylex.create({
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    minWidth: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  embedded: { borderBottomWidth: 0 },
  navigation: { borderBottomWidth: 0, flex: '1 1 auto', maxWidth: '100%' },
  actions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginInlineStart: 'auto',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
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
  readonly isEmbedded?: boolean;
  readonly actions?: ReactNode;
};

export type PageNavigationPlaceholderProps = {
  readonly items: ReadonlyArray<Pick<PageNavigationItem, 'id' | 'label'>>;
  readonly isEmbedded?: boolean;
  readonly actions?: ReactNode;
};

export function PageNavigationPlaceholder({
  items,
  isEmbedded = false,
  actions,
}: PageNavigationPlaceholderProps): ReactNode {
  return (
    <div aria-hidden inert {...stylex.props(styles.row, isEmbedded && styles.embedded)}>
      <div {...stylex.props(tabStyles.list, styles.navigation)}>
        {items.map((item) => (
          <span key={item.id} {...stylex.props(tabStyles.item)}>
            {item.label}
          </span>
        ))}
      </div>
      {Children.toArray(actions).length > 0 && <div {...stylex.props(headerStyles.row, styles.actions)}>{actions}</div>}
    </div>
  );
}

export function PageNavigation<ItemId extends string>({
  items,
  selectedId,
  onNavigate,
  label = 'Page sections',
  isEmbedded = false,
  actions,
}: PageNavigationProps<ItemId>): ReactNode {
  return (
    <div {...stylex.props(styles.row, isEmbedded && styles.embedded)}>
      <nav aria-label={label} {...stylex.props(tabStyles.list, styles.navigation)}>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.href}
            aria-current={item.id === selectedId ? 'page' : undefined}
            {...stylex.props(tabStyles.item)}
            onClick={(event) => {
              if (onNavigate === undefined || event.defaultPrevented || event.button !== 0) {
                return;
              }

              const hasCommandModifier = event.metaKey || event.ctrlKey;
              const hasAlternateModifier = event.shiftKey || event.altKey;

              if (hasCommandModifier || hasAlternateModifier) {
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
      {Children.toArray(actions).length > 0 && <div {...stylex.props(headerStyles.row, styles.actions)}>{actions}</div>}
    </div>
  );
}

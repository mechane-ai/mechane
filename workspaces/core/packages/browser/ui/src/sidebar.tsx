import { Button as BaseButton } from '@base-ui/react/button';
import { Dialog } from '@base-ui/react/dialog';
import { Select } from '@base-ui/react/select';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, PanelLeft } from 'lucide-react';
import { createContext, useContext, useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { colors, frame } from './tokens.stylex.ts';

type SidebarState = {
  readonly isExpanded: boolean;
  readonly sidebarId: string;
  readonly onToggle: () => void;
  readonly onNavigate: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

const styles = stylex.create({
  account: {
    'display': 'flex',
    'alignItems': 'center',
    'gap': 8,
    'height': frame.toolbarHeight,
    'width': '100%',
    'paddingTop': 0,
    'paddingBottom': 0,
    'paddingLeft': 6,
    'paddingRight': 12,
    'borderTopWidth': 0,
    'borderLeftWidth': 0,
    'borderRightWidth': 0,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    'minWidth': 0,
    'fontFamily': 'inherit',
    'fontSize': 14,
    'lineHeight': '20px',
    'textAlign': 'left',
    'color': colors.ink,
    'backgroundColor': colors.surface,
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -3 },
  },
  accountCollapsed: {
    justifyContent: { 'default': 'center', '@media (max-width:800px)': 'flex-start' },
    paddingRight: { 'default': 6, '@media (max-width:800px)': 12 },
  },
  accountIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.canvas,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 500,
  },
  accountLabel: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chevron: { display: 'flex', flexShrink: 0 },
  collapsedLabel: { display: { 'default': 'none', '@media (max-width:800px)': 'inline-flex' } },
  positioner: { zIndex: 30, minWidth: 224, maxWidth: 'calc(100vw - 16px)' },
  popup: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderRightStyle: 'solid',
    borderTopColor: colors.line,
    borderBottomColor: colors.line,
    borderLeftColor: colors.line,
    borderRightColor: colors.line,
    borderRadius: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 4,
    paddingRight: 4,
    backgroundColor: colors.surface,
    color: colors.ink,
    boxShadow: '0 4px 16px #00000014',
    maxHeight: 'var(--available-height)',
    overflowY: 'auto',
  },
  pointerPopup: {
    'transformOrigin': 'var(--transform-origin)',
    '@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)': {
      'transitionProperty': 'opacity, transform',
      'transitionDuration': '140ms',
      'transitionTimingFunction': 'cubic-bezier(0.2, 0.75, 0.25, 1)',
      ':is([data-starting-style])': { opacity: 0, transform: 'scale(0.98) translateY(-2px)' },
    },
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: 4,
    fontSize: 14,
    lineHeight: '20px',
    cursor: 'pointer',
    outlineWidth: 0,
  },
  highlighted: { backgroundColor: colors.canvas },
  optionText: { flex: 1, minWidth: 0 },
  navigation: { display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 7, paddingRight: 7 },
  navigationItem: {
    'display': 'flex',
    'alignItems': 'center',
    'gap': 8,
    'height': { 'default': frame.navigationHeight, '@media (max-width:800px)': 40 },
    'width': '100%',
    'paddingTop': 0,
    'paddingBottom': 0,
    'paddingLeft': 7,
    'paddingRight': 7,
    'borderTopWidth': 0,
    'borderBottomWidth': 0,
    'borderLeftWidth': 0,
    'borderRightWidth': 0,
    'borderRadius': 4,
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontSize': 13,
    'fontWeight': 400,
    'lineHeight': '20px',
    'textAlign': 'left',
    'textDecorationLine': 'none',
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -2 },
  },
  navigationCollapsed: { justifyContent: { 'default': 'center', '@media (max-width:800px)': 'flex-start' } },
  selected: { backgroundColor: colors.canvas },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: frame.iconSize,
    height: frame.iconSize,
    flexShrink: 0,
  },
  label: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: frame.brandHeight,
    paddingLeft: 14,
    paddingRight: 14,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    fontSize: 12,
    lineHeight: '18px',
    color: colors.muted,
    whiteSpace: 'nowrap',
  },
  brandCollapsed: {
    justifyContent: { 'default': 'center', '@media (max-width:800px)': 'flex-start' },
    paddingLeft: { 'default': 0, '@media (max-width:800px)': 14 },
    paddingRight: { 'default': 0, '@media (max-width:800px)': 14 },
  },
  toggle: {
    'alignItems': 'center',
    'justifyContent': 'center',
    'height': frame.toolbarHeight,
    'width': frame.toolbarHeight,
    'flexShrink': 0,
    'paddingTop': 0,
    'paddingBottom': 0,
    'paddingLeft': 0,
    'paddingRight': 0,
    'borderTopWidth': 0,
    'borderBottomWidth': 0,
    'borderLeftWidth': 0,
    'borderRightWidth': 1,
    'borderRightStyle': 'solid',
    'borderRightColor': colors.line,
    'backgroundColor': colors.surface,
    'color': colors.ink,
    'cursor': 'pointer',
    ':hover': { backgroundColor: colors.canvas },
    ':focus-visible': { outlineWidth: 2, outlineStyle: 'solid', outlineColor: colors.focus, outlineOffset: -3 },
  },
  desktop: { display: { 'default': 'flex', '@media (max-width:800px)': 'none' } },
  mobile: { display: { 'default': 'none', '@media (max-width:800px)': 'flex' } },
});

type SidebarAccountItem = { readonly value: string; readonly label: string };

type SidebarAccountProps = {
  readonly label: string;
  readonly value: string;
  readonly items: ReadonlyArray<SidebarAccountItem>;
  readonly onValueChange: (value: string) => void;
};

type NavigationProps = { readonly children: ReactNode; readonly label?: string };

type NavigationItemProps = ComponentProps<typeof BaseButton> & {
  readonly icon?: ReactNode;
  readonly selected?: boolean;
};

type NavigationLinkProps = ComponentProps<'a'> & { readonly icon?: ReactNode; readonly selected?: boolean };

type SidebarBrandProps = { readonly children: ReactNode; readonly icon?: ReactNode };

export function SidebarAccount({ label, value, items, onValueChange }: SidebarAccountProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;
  const selected = items.find((option) => option.value === value);
  const selectedLabel = selected === undefined ? label : selected.label;
  const initial = selectedLabel.slice(0, 1).toUpperCase();
  const [pointerOpen, setPointerOpen] = useState(false);

  return (
    <Select.Root<string>
      value={value}
      items={items}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue);
        }
      }}
    >
      <Select.Trigger
        onPointerDown={() => setPointerOpen(true)}
        onKeyDown={() => setPointerOpen(false)}
        aria-label={`${label}: ${selectedLabel}`}
        title={selectedLabel}
        {...stylex.props(styles.account, isCollapsed && styles.accountCollapsed)}
      >
        <span aria-hidden {...stylex.props(styles.accountIcon)}>
          {initial}
        </span>
        <Select.Value {...stylex.props(styles.accountLabel, isCollapsed && styles.collapsedLabel)} />
        <Select.Icon {...stylex.props(styles.chevron, isCollapsed && styles.collapsedLabel)}>
          <ChevronDown size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
          {...stylex.props(styles.positioner)}
        >
          <Select.Popup {...stylex.props(styles.popup, pointerOpen && styles.pointerPopup)}>
            <Select.List>
              {items.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={(state) => stylex.props(styles.option, state.highlighted && styles.highlighted).className}
                >
                  <Select.ItemText {...stylex.props(styles.optionText)}>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function Navigation({ children, label = 'Console' }: NavigationProps): ReactNode {
  return (
    <nav aria-label={label} {...stylex.props(styles.navigation)}>
      {children}
    </nav>
  );
}

export function NavigationItem({
  children,
  icon,
  selected = false,
  onClick,
  ...props
}: NavigationItemProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const labelId = useId();
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <BaseButton
      {...props}
      aria-current={selected ? 'page' : undefined}
      aria-labelledby={labelId}
      title={props.title ?? (typeof children === 'string' ? children : undefined)}
      onClick={(event) => {
        if (onClick !== undefined) {
          onClick(event);
        }

        if (sidebar !== null) {
          sidebar.onNavigate();
        }
      }}
      {...stylex.props(styles.navigationItem, isCollapsed && styles.navigationCollapsed, selected && styles.selected)}
    >
      {icon !== undefined && icon !== null && <span {...stylex.props(styles.icon)}>{icon}</span>}
      <span id={labelId} {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>
        {children}
      </span>
    </BaseButton>
  );
}

export function NavigationLink({
  children,
  icon,
  selected = false,
  onClick,
  ...props
}: NavigationLinkProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const labelId = useId();
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <a
      {...props}
      aria-current={selected ? 'page' : undefined}
      aria-labelledby={labelId}
      title={props.title ?? (typeof children === 'string' ? children : undefined)}
      onClick={(event) => {
        if (onClick !== undefined) {
          onClick(event);
        }

        if (sidebar !== null) {
          sidebar.onNavigate();
        }
      }}
      {...stylex.props(styles.navigationItem, isCollapsed && styles.navigationCollapsed, selected && styles.selected)}
    >
      {icon !== undefined && icon !== null && <span {...stylex.props(styles.icon)}>{icon}</span>}
      <span id={labelId} {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>
        {children}
      </span>
    </a>
  );
}

export function SidebarBrand({ children, icon }: SidebarBrandProps): ReactNode {
  const sidebar = useContext(SidebarContext);
  const isCollapsed = sidebar !== null && !sidebar.isExpanded;

  return (
    <div {...stylex.props(styles.brand, isCollapsed && styles.brandCollapsed)}>
      {icon !== undefined && icon !== null && (
        <span aria-hidden {...stylex.props(styles.icon)}>
          {icon}
        </span>
      )}
      <span {...stylex.props(styles.label, isCollapsed && styles.collapsedLabel)}>{children}</span>
    </div>
  );
}

export function SidebarToggle(): ReactNode {
  const sidebar = useContext(SidebarContext);

  if (sidebar === null) {
    return null;
  }

  return (
    <>
      <BaseButton
        aria-label={sidebar.isExpanded ? 'Collapse navigation' : 'Expand navigation'}
        aria-controls={sidebar.sidebarId}
        aria-expanded={sidebar.isExpanded}
        onClick={sidebar.onToggle}
        {...stylex.props(styles.toggle, styles.desktop)}
      >
        <PanelLeft size={16} aria-hidden />
      </BaseButton>
      <Dialog.Trigger
        render={<BaseButton aria-label="Open navigation" {...stylex.props(styles.toggle, styles.mobile)} />}
      >
        <PanelLeft size={16} aria-hidden />
      </Dialog.Trigger>
    </>
  );
}

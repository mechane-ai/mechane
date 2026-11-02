import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  layout: {
    minHeight: '100dvh',
    display: 'grid',
    gridTemplateColumns: { 'default': '232px minmax(0, 1fr)', '@media (max-width: 800px)': 'minmax(0, 1fr)' },
    backgroundColor: colors.canvas,
    color: colors.ink,
  },
  sidebar: {
    'display': 'flex',
    'flexDirection': 'column',
    'gap': 30,
    'padding': '28px 22px',
    'borderRight': `1px solid ${colors.line}`,
    'backgroundColor': colors.surface,
    '@media (max-width: 800px)': {
      borderRight: 0,
      borderBottom: `1px solid ${colors.line}`,
      padding: '18px 22px',
      gap: 16,
    },
  },
  footer: { marginTop: 'auto', paddingTop: 30 },
  content: {
    padding: { 'default': '38px 44px', '@media (max-width: 800px)': '24px 18px' },
    maxWidth: 1240,
    width: '100%',
    boxSizing: 'border-box',
    marginInline: 'auto',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 5 },
  navItem: {
    font: 'inherit',
    textAlign: 'left',
    border: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 6,
    padding: '11px 12px',
    backgroundColor: 'transparent',
    fontSize: 13,
    color: colors.muted,
    cursor: 'pointer',
  },
  navSelected: { backgroundColor: colors.accentSoft, color: colors.accent, fontWeight: 600 },
  scroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' },
  th: {
    padding: '13px 20px',
    backgroundColor: colors.canvas,
    color: colors.muted,
    fontSize: 11,
    fontWeight: 550,
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${colors.line}`,
  },
  td: { padding: '17px 20px', borderBottom: `1px solid ${colors.line}`, color: colors.ink, verticalAlign: 'top' },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: { 'default': 'repeat(3, minmax(0, 1fr))', '@media (max-width: 600px)': '1fr' },
    gap: 14,
  },
  metric: {
    padding: '20px 22px',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.line}`,
    borderRadius: 9,
  },
  metricLabel: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  metricValue: { fontSize: 25, fontWeight: 550, letterSpacing: '-0.5px' },
  tabs: { display: 'flex', gap: 20, borderBottom: `1px solid ${colors.line}`, overflowX: 'auto' },
  tab: {
    font: 'inherit',
    border: 0,
    padding: '12px 0',
    backgroundColor: 'transparent',
    borderBottom: '2px solid transparent',
    color: colors.muted,
    cursor: 'pointer',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  selectedTab: { borderBottomColor: colors.accent, color: colors.accent, fontWeight: 600 },
});

export function Layout({
  sidebar,
  footer,
  children,
}: {
  readonly sidebar: ReactNode;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.layout)}>
      <aside {...stylex.props(styles.sidebar)}>
        {sidebar}
        <div {...stylex.props(styles.footer)}>{footer}</div>
      </aside>
      <main id="main" {...stylex.props(styles.content)}>
        {children}
      </main>
    </div>
  );
}

export function Navigation({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <nav aria-label="Console" {...stylex.props(styles.nav)}>
      {children}
    </nav>
  );
}

export function NavigationItem({
  children,
  selected,
  onClick,
}: {
  readonly children: ReactNode;
  readonly selected: boolean;
  readonly onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      {...stylex.props(styles.navItem, selected && styles.navSelected)}
    >
      {children}
    </button>
  );
}

export function Table({
  headers,
  children,
  label,
}: {
  readonly headers: ReadonlyArray<string>;
  readonly children: ReactNode;
  readonly label: string;
}): ReactNode {
  return (
    <div {...stylex.props(styles.scroll)}>
      <table aria-label={label} {...stylex.props(styles.table)}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" {...stylex.props(styles.th)}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children }: { readonly children?: ReactNode }): ReactNode {
  return <td {...stylex.props(styles.td)}>{children}</td>;
}

export function MetricGrid({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.metricGrid)}>{children}</div>;
}

export function Metric({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
}): ReactNode {
  return (
    <div {...stylex.props(styles.metric)}>
      <div {...stylex.props(styles.metricLabel)}>{label}</div>
      <div {...stylex.props(styles.metricValue)}>{value}</div>
      {detail}
    </div>
  );
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: ReadonlyArray<T>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}): ReactNode {
  return (
    <nav aria-label="Mech details" {...stylex.props(styles.tabs)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-current={option === value ? 'page' : undefined}
          onClick={() => onChange(option)}
          {...stylex.props(styles.tab, option === value && styles.selectedTab)}
        >
          {option}
        </button>
      ))}
    </nav>
  );
}

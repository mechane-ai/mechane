import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  scroll: { minWidth: 0, width: '100%', overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: colors.surface,
    fontSize: 14,
    lineHeight: '20px',
    textAlign: 'left',
  },
  fixed: { tableLayout: 'fixed', minWidth: 720 },
  column: (width: number) => ({ width: `${width}%` }),
  th: {
    'position': 'relative',
    'height': 36,
    'boxSizing': 'border-box',
    'paddingBlock': 0,
    'paddingInline': 16,
    'backgroundColor': colors.surface,
    'color': colors.muted,
    'fontSize': 13,
    'fontWeight': 400,
    'whiteSpace': 'nowrap',
    '::after': {
      content: '""',
      position: 'absolute',
      right: 0,
      top: 10,
      height: 16,
      width: 1,
      backgroundColor: colors.line,
    },
  },
  lastHeader: { '::after': { display: 'none' } },
  td: {
    height: 39,
    boxSizing: 'border-box',
    paddingBlock: 0,
    paddingInline: 16,
    color: colors.ink,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

export function Table({
  headers,
  children,
  label,
}: {
  readonly headers: ReadonlyArray<string | { readonly label: string; readonly width: number }>;
  readonly children: ReactNode;
  readonly label: string;
}): ReactNode {
  return (
    <div {...stylex.props(styles.scroll)}>
      <table
        aria-label={label}
        {...stylex.props(styles.table, headers.some((header) => typeof header !== 'string') && styles.fixed)}
      >
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={typeof header === 'string' ? header : header.label}
                scope="col"
                {...stylex.props(
                  styles.th,
                  typeof header !== 'string' && styles.column(header.width),
                  index === headers.length - 1 && styles.lastHeader,
                )}
              >
                {typeof header === 'string' ? header : header.label}
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

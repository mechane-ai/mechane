import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  scroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' },
  th: {
    padding: '10px 14px',
    backgroundColor: colors.canvas,
    color: colors.muted,
    fontSize: 11,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  td: {
    padding: '12px 14px',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    color: colors.ink,
    verticalAlign: 'middle',
  },
});

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

import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import {
  colors,
  conditions,
  controls,
  pageGeometry,
  spacing,
  tableGeometry,
  typography,
} from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  scroll: {
    'minWidth': 0,
    'width': '100%',
    'overflowX': 'auto',
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    textAlign: 'left',
  },
  fixed: { tableLayout: 'fixed' },
  secondary: { display: { default: 'table-cell', [conditions.compactTable]: 'none' } },
  mobileLabel: {
    display: { default: 'none', [conditions.compactTable]: 'block' },
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  column: (width: number) => ({ width: { default: `${width}%`, [conditions.compactTable]: 'auto' } }),
  th: {
    'position': 'relative',
    'height': tableGeometry.headerHeight,
    'boxSizing': 'border-box',
    'paddingBlock': 0,
    'paddingInline': pageGeometry.inset,
    'backgroundColor': colors.surface,
    'color': colors.muted,
    'fontSize': typography.captionSize,
    'fontWeight': typography.regularWeight,
    'lineHeight': typography.captionLineHeight,
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
  headerLabel: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' },
  lastHeader: { '::after': { display: 'none' } },
  lastPrimaryHeader: { '::after': { display: { [conditions.compactTable]: 'none' } } },
  td: {
    height: tableGeometry.rowHeight,
    boxSizing: 'border-box',
    paddingBlock: spacing.xs,
    paddingInline: pageGeometry.inset,
    color: colors.ink,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

type TableHeader = string | { readonly label: string; readonly width: number; readonly secondary?: boolean };
type TableProps = ComponentProps<'table'> & { readonly headers: ReadonlyArray<TableHeader>; readonly label: string };
type CellProps = ComponentProps<'td'> & { readonly secondary?: boolean; readonly mobileLabel?: string };

export function Table({ headers, children, label, ...props }: TableProps): ReactNode {
  const lastPrimaryHeader = headers.findLastIndex((header) => typeof header === 'string' || header.secondary !== true);

  return (
    <div role="region" aria-label={label} tabIndex={0} {...stylex.props(styles.scroll)}>
      <table
        {...mergeProps(
          { 'aria-label': label },
          stylex.props(styles.table, headers.some((header) => typeof header !== 'string') && styles.fixed),
          props,
        )}
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
                  typeof header !== 'string' && header.secondary === true && styles.secondary,
                  index === headers.length - 1 && styles.lastHeader,
                  index === lastPrimaryHeader && styles.lastPrimaryHeader,
                )}
              >
                <span title={typeof header === 'string' ? header : header.label} {...stylex.props(styles.headerLabel)}>
                  {typeof header === 'string' ? header : header.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, secondary = false, mobileLabel, ...props }: CellProps): ReactNode {
  return (
    <td {...mergeProps(stylex.props(styles.td, secondary && styles.secondary), props)}>
      {children}
      {mobileLabel !== undefined && <small {...stylex.props(styles.mobileLabel)}>{mobileLabel}</small>}
    </td>
  );
}

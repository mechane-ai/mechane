import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { colors, spacing, tableGeometry } from '../../foundations/src/tokens.stylex.ts';
import { Skeleton } from './skeleton.tsx';

const styles = stylex.create({
  region: { minWidth: 0, position: 'relative' },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'center',
    minHeight: tableGeometry.rowHeight,
    boxSizing: 'border-box',
  },
  cell: { minWidth: 0, paddingInline: spacing.lg },
  head: {
    minHeight: tableGeometry.headerHeight,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  detail: { display: 'grid', gap: spacing.lg, paddingBlock: spacing.lg },
});

type LoadingProps = { readonly label: string; readonly shape?: 'rows' | 'detail' };

export function Loading({ label, shape = 'rows' }: LoadingProps): ReactNode {
  return (
    <div role="status" {...stylex.props(styles.region)}>
      <span {...stylex.props(accessibility.hidden)}>{label}</span>
      {shape === 'rows' ? (
        <div aria-hidden>
          <div {...stylex.props(styles.row, styles.head)}>
            <div {...stylex.props(styles.cell)}>
              <Skeleton width={54} />
            </div>
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} {...stylex.props(styles.row)}>
              <div {...stylex.props(styles.cell)}>
                <Skeleton width={row === 1 ? 108 : 174} />
              </div>
              <div {...stylex.props(styles.cell)}>
                <Skeleton width={54} />
              </div>
              <div {...stylex.props(styles.cell)}>
                <Skeleton width={108} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden {...stylex.props(styles.detail)}>
          <Skeleton width={216} height={24} />
          <Skeleton width={174} />
          <Skeleton width={108} />
        </div>
      )}
    </div>
  );
}

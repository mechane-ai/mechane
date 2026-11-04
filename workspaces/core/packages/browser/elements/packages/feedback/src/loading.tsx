import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { colors, spacing } from '../../foundations/src/tokens.stylex.ts';
import { Skeleton } from './skeleton.tsx';

const styles = stylex.create({
  region: { minWidth: 0, position: 'relative' },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: 20,
    alignItems: 'center',
    minHeight: 39,
    paddingInline: spacing.lg,
  },
  head: { minHeight: 36, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: colors.line },
  detail: { display: 'grid', gap: 20, paddingBlock: 16 },
});

type LoadingProps = { readonly label: string; readonly shape?: 'rows' | 'detail' };

export function Loading({ label, shape = 'rows' }: LoadingProps): ReactNode {
  return (
    <div role="status" {...stylex.props(styles.region)}>
      <span {...stylex.props(accessibility.hidden)}>{label}</span>
      {shape === 'rows' ? (
        <div aria-hidden>
          <div {...stylex.props(styles.row, styles.head)}>
            <Skeleton width={54} />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} {...stylex.props(styles.row)}>
              <Skeleton width={row === 1 ? 108 : 174} />
              <Skeleton width={54} />
              <Skeleton width={108} />
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

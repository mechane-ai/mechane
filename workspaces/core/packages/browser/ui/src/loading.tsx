import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { accessibility } from './accessibility.ts';
import { colors, radii, spacing } from './tokens.stylex.ts';

const styles = stylex.create({
  region: { minWidth: 0, position: 'relative' },
  line: { height: 8, borderRadius: radii.sm, backgroundColor: colors.canvas, maxWidth: '100%' },
  short: { width: 54 },
  medium: { width: 108 },
  long: { width: 174 },
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
  title: { width: 216, height: 24 },
});

type LoadingProps = { readonly label: string; readonly shape?: 'rows' | 'detail' };

export function Loading({ label, shape = 'rows' }: LoadingProps): ReactNode {
  return (
    <div role="status" {...stylex.props(styles.region)}>
      <span {...stylex.props(accessibility.hidden)}>{label}</span>
      {shape === 'rows' ? (
        <div aria-hidden>
          <div {...stylex.props(styles.row, styles.head)}>
            <span {...stylex.props(styles.line, styles.short)} />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} {...stylex.props(styles.row)}>
              <span {...stylex.props(styles.line, row === 1 ? styles.medium : styles.long)} />
              <span {...stylex.props(styles.line, styles.short)} />
              <span {...stylex.props(styles.line, styles.medium)} />
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden {...stylex.props(styles.detail)}>
          <span {...stylex.props(styles.line, styles.title)} />
          <span {...stylex.props(styles.line, styles.long)} />
          <span {...stylex.props(styles.line, styles.medium)} />
        </div>
      )}
    </div>
  );
}

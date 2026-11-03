import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors } from './tokens.stylex.ts';

const styles = stylex.create({
  region: { minWidth: 0, position: 'relative' },
  line: { height: 8, borderRadius: 2, backgroundColor: colors.canvas, maxWidth: '100%' },
  short: { width: 54 },
  medium: { width: 108 },
  long: { width: 174 },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    columnGap: 20,
    alignItems: 'center',
    minHeight: 39,
    paddingInline: 16,
  },
  head: { minHeight: 36, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: colors.line },
  detail: { display: 'grid', gap: 20, paddingBlock: 16 },
  title: { width: 216, height: 24 },
  hidden: {
    position: 'absolute',
    clipPath: 'inset(50%)',
    overflow: 'hidden',
    width: 1,
    height: 1,
    whiteSpace: 'nowrap',
  },
});

export function Loading({
  label,
  shape = 'rows',
}: {
  readonly label: string;
  readonly shape?: 'rows' | 'detail';
}): ReactNode {
  return (
    <div role="status" {...stylex.props(styles.region)}>
      <span {...stylex.props(styles.hidden)}>{label}</span>
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

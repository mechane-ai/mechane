import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  timestamp: {
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
  },
});

export type TimestampProps = { readonly dateTime: string; readonly label: string; readonly title?: string };

export function Timestamp({ dateTime, label, title }: TimestampProps): ReactNode {
  return (
    <time dateTime={dateTime} title={title} {...stylex.props(styles.timestamp)}>
      {label}
    </time>
  );
}

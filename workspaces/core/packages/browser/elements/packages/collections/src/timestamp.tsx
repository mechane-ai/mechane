import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, controls, typography } from '../../foundations/src/tokens.stylex.ts';
import { Tooltip } from '../../overlays/src/index.ts';

const styles = stylex.create({
  timestamp: {
    'fontFamily': typography.fontFamily,
    'fontSize': typography.captionSize,
    'lineHeight': typography.captionLineHeight,
    'color': colors.muted,
    'fontVariantNumeric': 'tabular-nums',
    'overflowWrap': 'anywhere',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
});

export type TimestampProps = { readonly dateTime: string; readonly label: string; readonly title?: string };

export function Timestamp({ dateTime, label, title }: TimestampProps): ReactNode {
  if (title === undefined) {
    return (
      <time dateTime={dateTime} {...stylex.props(styles.timestamp)}>
        {label}
      </time>
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<time dateTime={dateTime} tabIndex={0} aria-label={title} {...stylex.props(styles.timestamp)} />}
      >
        {label}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>{title}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls } from '../../foundations/src/tokens.stylex.ts';
import { Skeleton, SkeletonText } from './skeleton.tsx';

const styles = stylex.create({
  button: { backgroundColor: colors.canvas, verticalAlign: 'middle' },
  singleLine: { display: 'flex', alignItems: 'center' },
  width: (width: number | string) => ({ width, maxWidth: '100%' }),
  rows: (rows: number) => ({ height: `calc(${rows} * 1lh + 2 * ${controls.paddingBlock} + 2px)` }),
});

export type ButtonPlaceholderProps = { readonly xstyle?: PlacementStyle } & (
  | { readonly icon: true; readonly width?: never }
  | { readonly icon?: false; readonly width?: number | string }
);

export type FieldPlaceholderProps = {
  readonly label?: string;
  readonly hint?: string;
  readonly multiline?: boolean;
  readonly rows?: number;
  readonly width?: number | string;
  readonly xstyle?: PlacementStyle;
};

export function ButtonPlaceholder({ width = '7ch', icon = false, xstyle }: ButtonPlaceholderProps): ReactNode {
  return (
    <span
      aria-hidden
      inert
      {...stylex.props(
        controlStyles.base,
        controlStyles.button,
        icon && controlStyles.iconButton,
        styles.button,
        xstyle,
      )}
    >
      {icon ? <Skeleton width={controls.iconSize} height={controls.iconSize} /> : <SkeletonText width={width} />}
    </span>
  );
}

export function FieldPlaceholder({
  label,
  hint,
  multiline = false,
  rows = 4,
  width = '100%',
  xstyle,
}: FieldPlaceholderProps): ReactNode {
  const lineCount = multiline ? Math.min(rows, 6) : 1;

  return (
    <div aria-hidden {...stylex.props(controlStyles.fieldRoot, styles.width(width), xstyle)}>
      {label !== undefined && <span {...stylex.props(controlStyles.label)}>{label}</span>}
      <div
        {...stylex.props(
          controlStyles.base,
          controlStyles.field,
          !multiline && styles.singleLine,
          multiline && controlStyles.textarea,
          multiline && styles.rows(rows),
        )}
      >
        <SkeletonText width="60%" lines={lineCount} />
      </div>
      {hint !== undefined && <span {...stylex.props(controlStyles.description)}>{hint}</span>}
    </div>
  );
}

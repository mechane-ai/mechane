import * as stylex from '@stylexjs/stylex';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { accessibility } from './accessibility.ts';
import { colors, controls, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  skeleton: {
    display: 'block',
    maxWidth: '100%',
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  dimensions: (width: number | `${number}%`, height: number) => ({ width, height }),
  circle: { borderRadius: '50%' },
  rectangle: {},
  text: { display: 'flex', flexDirection: 'column', gap: spacing.sm, width: '100%' },
  spinner: {
    display: 'inline-flex',
    position: 'relative',
    alignItems: 'center',
    gap: spacing.sm,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  icon: { width: controls.iconSize, height: controls.iconSize, flexShrink: 0 },
});

type SkeletonShape = 'rectangle' | 'circle';

export type SkeletonProps = {
  readonly width?: number | `${number}%`;
  readonly height?: number;
  readonly shape?: SkeletonShape;
};

export type SkeletonTextProps = { readonly lines?: number };
export type SpinnerProps = { readonly label: string; readonly showLabel?: boolean };

const shapes = { rectangle: styles.rectangle, circle: styles.circle } satisfies Record<
  SkeletonShape,
  stylex.StyleXStyles
>;

export function Skeleton({ width = '100%', height = 8, shape = 'rectangle' }: SkeletonProps): ReactNode {
  return <span aria-hidden {...stylex.props(styles.skeleton, styles.dimensions(width, height), shapes[shape])} />;
}

export function SkeletonText({ lines = 3 }: SkeletonTextProps): ReactNode {
  return (
    <div aria-hidden {...stylex.props(styles.text)}>
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton key={`placeholder-${line}`} width={line === lines - 1 ? '65%' : '100%'} />
      ))}
    </div>
  );
}

export function Spinner({ label, showLabel = false }: SpinnerProps): ReactNode {
  return (
    <span role="status" {...stylex.props(styles.spinner)}>
      <LoaderCircle aria-hidden {...stylex.props(styles.icon)} />
      <span {...stylex.props(!showLabel && accessibility.hidden)}>{label}</span>
    </span>
  );
}

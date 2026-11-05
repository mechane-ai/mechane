import * as stylex from '@stylexjs/stylex';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  skeleton: { display: 'block', maxWidth: '100%', backgroundColor: colors.line, borderRadius: radii.sm, flexShrink: 0 },
  dimensions: (width: number | string, height: number | string) => ({ width, height }),
  width: (width: number | string) => ({ width }),
  circle: { borderRadius: '50%' },
  rectangle: {},
  text: { display: 'inline-flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', verticalAlign: 'top' },
  line: { display: 'flex', alignItems: 'center', height: '1lh' },
  spinner: {
    display: 'inline-flex',
    position: 'relative',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
    gap: spacing.sm,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    overflowWrap: 'anywhere',
  },
  icon: { width: controls.iconSize, height: controls.iconSize, flexShrink: 0 },
  label: { minWidth: 0 },
});

type SkeletonShape = 'rectangle' | 'circle';

export type SkeletonProps = {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly shape?: SkeletonShape;
};

export type SkeletonTextProps = { readonly lines?: number; readonly width?: number | string };
export type SpinnerProps = { readonly label: string; readonly showLabel?: boolean };

const shapes = { rectangle: styles.rectangle, circle: styles.circle } satisfies Record<
  SkeletonShape,
  stylex.StyleXStyles
>;

export function Skeleton({ width = '100%', height = 8, shape = 'rectangle' }: SkeletonProps): ReactNode {
  return <span aria-hidden {...stylex.props(styles.skeleton, styles.dimensions(width, height), shapes[shape])} />;
}

export function SkeletonText({ lines = 1, width = '100%' }: SkeletonTextProps): ReactNode {
  return (
    <span aria-hidden {...stylex.props(styles.text, styles.width(width))}>
      {Array.from({ length: lines }, (_, line) => (
        <span key={`placeholder-${line}`} {...stylex.props(styles.line)}>
          <Skeleton width={lines > 1 && line === lines - 1 ? '65%' : '100%'} height="0.6em" />
        </span>
      ))}
    </span>
  );
}

export function Spinner({ label, showLabel = false }: SpinnerProps): ReactNode {
  return (
    <span role="status" {...stylex.props(styles.spinner)}>
      <LoaderCircle aria-hidden {...stylex.props(styles.icon)} />
      <span {...stylex.props(styles.label, !showLabel && accessibility.hidden)}>{label}</span>
    </span>
  );
}

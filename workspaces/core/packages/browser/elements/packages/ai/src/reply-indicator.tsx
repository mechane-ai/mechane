import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, typography } from '../../foundations/src/tokens.stylex.ts';
import { useVisibleMotion } from '../../foundations/src/visible-motion.ts';

const sweep = stylex.keyframes({ from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-100% 0' } });

const styles = stylex.create({
  root: {
    minHeight: '1lh',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.proseLineHeight,
  },
  motion: {
    backgroundImage: `linear-gradient(100deg, ${colors.muted} 30%, ${colors.ink} 50%, ${colors.muted} 70%)`,
    backgroundSize: '250% 100%',
    backgroundClip: 'text',
    color: { default: 'transparent', [conditions.reducedMotion]: colors.muted },
    animationName: sweep,
    animationDuration: '900ms',
    animationIterationCount: 2,
    animationTimingFunction: 'ease-in-out',
    animationPlayState: { default: 'running', [conditions.reducedMotion]: 'paused' },
  },
  paused: { animationPlayState: 'paused' },
});

export type ReplyIndicatorProps = { readonly label: string; readonly delayMs?: number; readonly isAnimated?: boolean };

export function ReplyIndicator({ label, delayMs = 200, isAnimated = true }: ReplyIndicatorProps) {
  const [isVisible, setIsVisible] = useState(delayMs === 0);
  const { ref, isActive } = useVisibleMotion(isAnimated && isVisible);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delayMs);

    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <div ref={ref} {...stylex.props(styles.root)}>
      {isVisible && (
        <span role="status" {...stylex.props(isAnimated && styles.motion, !isActive && styles.paused)}>
          {label}
        </span>
      )}
    </div>
  );
}

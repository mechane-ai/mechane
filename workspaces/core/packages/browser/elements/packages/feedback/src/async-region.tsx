import * as stylex from '@stylexjs/stylex';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { conditions, motion } from '../../foundations/src/tokens.stylex.ts';

const RevealedTogether = createContext(false);
const reveal = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const styles = stylex.create({
  region: { position: 'relative', minWidth: 0 },
  fillRegion: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  hidden: { visibility: 'hidden' },
  reveal: {
    animationName: { default: reveal, [conditions.reducedMotion]: 'none' },
    animationDuration: motion.duration,
    animationTimingFunction: motion.easing,
  },
});

export type ContentRevealProps = {
  readonly enter: boolean;
  readonly fill?: boolean | undefined;
  readonly children: ReactNode;
};

export function ContentReveal({ enter, fill = false, children }: ContentRevealProps): ReactNode {
  const together = useContext(RevealedTogether);
  const [animate] = useState(enter && !together);
  const [coordinating, setCoordinating] = useState(animate);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCoordinating(false));

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div {...stylex.props(fill && styles.fillRegion, animate && styles.reveal)}>
      <RevealedTogether value={coordinating}>{children}</RevealedTogether>
    </div>
  );
}

export type AsyncRegionProps = {
  readonly pending: boolean;
  readonly label: string;
  readonly placeholder: ReactNode;
  readonly children?: ReactNode;
  readonly fill?: boolean | undefined;
  readonly startedAt?: number | undefined;
  readonly delayMs?: number | undefined;
};

type PendingContentProps = Omit<AsyncRegionProps, 'pending' | 'children'>;

function PendingContent({ label, placeholder, fill = false, startedAt, delayMs = 0 }: PendingContentProps): ReactNode {
  const [started] = useState(() => startedAt ?? Date.now());
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    const remaining = Math.max(0, delayMs - (Date.now() - started));
    const timer = setTimeout(() => setVisible(true), remaining);

    return () => clearTimeout(timer);
  }, [started, delayMs]);

  return (
    <div {...stylex.props(fill && styles.fillRegion, !visible && styles.hidden, visible && styles.reveal)}>
      {visible && (
        <span role="status" {...stylex.props(accessibility.hidden)}>
          {label}
        </span>
      )}
      <div aria-hidden="true" inert {...stylex.props(fill && styles.fillRegion)}>
        {placeholder}
      </div>
    </div>
  );
}

export function AsyncRegion({
  pending,
  label,
  placeholder,
  children,
  fill = false,
  startedAt,
  delayMs,
}: AsyncRegionProps): ReactNode {
  const [wasPending, setWasPending] = useState(pending);

  if (pending && !wasPending) {
    setWasPending(true);
  }

  return (
    <div aria-busy={pending} {...stylex.props(styles.region, fill && styles.fillRegion)}>
      {pending ? (
        <PendingContent
          key={startedAt}
          label={label}
          placeholder={placeholder}
          fill={fill}
          startedAt={startedAt}
          delayMs={delayMs}
        />
      ) : (
        <ContentReveal enter={wasPending} fill={fill}>
          {children}
        </ContentReveal>
      )}
    </div>
  );
}

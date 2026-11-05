import * as stylex from '@stylexjs/stylex';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { conditions, loading, motion } from '../../foundations/src/tokens.stylex.ts';

type LoadingClock = { readonly identity: string | number; readonly startedAt: number };

const LoadingStarted = createContext<LoadingClock | undefined>(undefined);
const RevealingTogether = createContext(false);
const reveal = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const MILLISECONDS_PER_SECOND = 1000;
const PLACEHOLDER_DELAY_MS = loading.delaySeconds * MILLISECONDS_PER_SECOND;

const styles = stylex.create({
  region: { position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 },
  content: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 },
  hidden: { visibility: 'hidden' },
  reveal: {
    animationName: { default: reveal, [conditions.reducedMotion]: 'none' },
    animationDuration: `${loading.revealMs}ms`,
    animationTimingFunction: motion.easing,
  },
  placeholderReveal: { animationDuration: `${loading.placeholderMs}ms` },
});

export type LoadingScopeProps = { readonly identity: string | number; readonly children: ReactNode };

export function LoadingScope({ identity, children }: LoadingScopeProps): ReactNode {
  const [clock, setClock] = useState(() => ({ identity, startedAt: Date.now() }));
  let current = clock;

  if (clock.identity !== identity) {
    current = { identity, startedAt: Date.now() };

    setClock(current);
  }

  return <LoadingStarted value={current}>{children}</LoadingStarted>;
}

export type ContentRevealProps = { readonly enter: boolean; readonly children: ReactNode };

export function ContentReveal({ enter, children }: ContentRevealProps): ReactNode {
  const ancestorRevealing = useContext(RevealingTogether);
  const [revealing, setRevealing] = useState(enter && !ancestorRevealing);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = content.current;

    if (!revealing || element === null) {
      return;
    }

    let current = true;

    void Promise.allSettled(element.getAnimations().map((animation) => animation.finished)).then(() => {
      if (current) {
        setRevealing(false);
      }
    });

    return () => {
      current = false;
    };
  }, [revealing]);

  return (
    <div ref={content} {...stylex.props(styles.content, revealing && styles.reveal)}>
      <RevealingTogether value={ancestorRevealing || revealing}>{children}</RevealingTogether>
    </div>
  );
}

export type AsyncRegionState = 'pending' | 'ready' | 'failed';

export type AsyncRegionProps = { readonly label: string; readonly placeholder: ReactNode } & (
  | { readonly state: 'pending'; readonly children?: never }
  | { readonly state: 'ready' | 'failed'; readonly children: ReactNode }
);

type PendingContentProps = { readonly label: string; readonly placeholder: ReactNode; readonly startedAt: number };

function PendingContent({ label, placeholder, startedAt }: PendingContentProps): ReactNode {
  const [shownFor, setShownFor] = useState<number | undefined>(() =>
    Date.now() - startedAt >= PLACEHOLDER_DELAY_MS ? startedAt : undefined,
  );

  const visible = shownFor === startedAt;

  useEffect(() => {
    const remaining = Math.max(0, PLACEHOLDER_DELAY_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => setShownFor(startedAt), remaining);

    return () => clearTimeout(timer);
  }, [startedAt]);

  return (
    <>
      <div aria-busy {...stylex.props(styles.content)}>
        <div
          aria-hidden
          inert
          {...stylex.props(
            styles.content,
            !visible && styles.hidden,
            visible && styles.reveal,
            styles.placeholderReveal,
          )}
        >
          {placeholder}
        </div>
      </div>
      {visible && (
        <span role="status" {...stylex.props(accessibility.hidden)}>
          {label}
        </span>
      )}
    </>
  );
}

export function AsyncRegion(props: AsyncRegionProps): ReactNode {
  const scope = useContext(LoadingStarted);

  const [presentation, setPresentation] = useState(() => ({
    state: props.state,
    scope,
    startedAt: scope?.startedAt ?? Date.now(),
    wasPending: props.state === 'pending',
  }));

  let current = presentation;

  if (presentation.scope !== scope || presentation.state !== props.state) {
    const changedScope = presentation.scope !== scope;
    let startedAt = presentation.startedAt;

    if (changedScope) {
      startedAt = scope?.startedAt ?? Date.now();
    } else if (props.state === 'pending') {
      startedAt = Date.now();
    }

    current = {
      state: props.state,
      scope,
      startedAt,
      wasPending: props.state === 'pending' || (!changedScope && presentation.wasPending),
    };

    setPresentation(current);
  }

  return (
    <div {...stylex.props(styles.region)}>
      {props.state === 'pending' ? (
        <PendingContent label={props.label} placeholder={props.placeholder} startedAt={current.startedAt} />
      ) : props.state === 'failed' ? (
        <div {...stylex.props(styles.content)}>{props.children}</div>
      ) : (
        <ContentReveal enter={current.wasPending}>{props.children}</ContentReveal>
      )}
    </div>
  );
}

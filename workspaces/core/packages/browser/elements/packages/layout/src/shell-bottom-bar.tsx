import * as stylex from '@stylexjs/stylex';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const styles = stylex.create({
  row: {
    minWidth: 0,
    display: { 'default': 'grid', '@media print': 'none' },
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
});

export function ShellBottomBar({ children }: { readonly children: ReactNode }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = ref.current;

    if (row === null) {
      return;
    }

    // Portaled notifications live outside the shell's grid.
    const root = row.ownerDocument.documentElement;

    function measure() {
      root.style.setProperty('--mechane-shell-bottom-inset', `${ref.current?.getBoundingClientRect().height ?? 0}px`);
    }

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(row, { box: 'border-box' });

    return () => {
      observer.disconnect();
      root.style.removeProperty('--mechane-shell-bottom-inset');
    };
  }, []);

  return (
    <div ref={ref} data-mechane-shell-bottom-bar="" {...stylex.props(styles.row)}>
      {children}
    </div>
  );
}

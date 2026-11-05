import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
  region: { position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  concealed: { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none' },
});

function ViewStackRoot({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.region)}>{children}</div>;
}

function ViewStackPanel({ active, children }: { readonly active: boolean; readonly children: ReactNode }): ReactNode {
  return (
    <section aria-hidden={!active} inert={!active} {...stylex.props(styles.region, !active && styles.concealed)}>
      {children}
    </section>
  );
}

export const ViewStack = { Root: ViewStackRoot, Panel: ViewStackPanel };

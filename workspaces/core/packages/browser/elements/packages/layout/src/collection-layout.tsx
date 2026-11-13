import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
  root: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, overflow: 'clip' },
  header: { flexShrink: 0, minWidth: 0 },
  body: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
});

export type CollectionLayoutProps = { readonly header?: ReactNode; readonly children: ReactNode };

export function CollectionLayout({ header, children }: CollectionLayoutProps): ReactNode {
  return (
    <div data-page-layout="collection" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.header)}>{header}</div>
      <div {...stylex.props(styles.body)}>{children}</div>
    </div>
  );
}

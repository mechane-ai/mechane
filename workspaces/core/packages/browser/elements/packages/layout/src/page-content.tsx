import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { pageGeometry } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  content: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: pageGeometry.sectionGap,
    minWidth: 0,
    padding: pageGeometry.inset,
  },
});

export type PageContentProps = { readonly children: ReactNode };

export function PageContent({ children }: PageContentProps): ReactNode {
  return <div {...stylex.props(styles.content)}>{children}</div>;
}

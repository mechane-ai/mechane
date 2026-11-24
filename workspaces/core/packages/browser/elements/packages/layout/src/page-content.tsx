import * as stylex from '@stylexjs/stylex';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { pageGeometry } from '../../foundations/src/tokens.stylex.ts';

const InsidePageContent = createContext(false);

const styles = stylex.create({
  content: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: pageGeometry.sectionGap,
    minWidth: 0,
    padding: pageGeometry.inset,
  },
  nested: { padding: 0 },
});

export type PageContentProps = { readonly children: ReactNode };

export function PageContent({ children }: PageContentProps): ReactNode {
  const isNested = useContext(InsidePageContent);

  return (
    <InsidePageContent value={true}>
      <div {...stylex.props(styles.content, isNested && styles.nested)}>{children}</div>
    </InsidePageContent>
  );
}

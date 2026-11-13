import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { PageContent } from './page-content.tsx';

const styles = stylex.create({ root: { minWidth: 0 } });

export type ReportContentProps = { readonly summary: ReactNode; readonly breakdown?: ReactNode };

export function ReportContent({ summary, breakdown }: ReportContentProps): ReactNode {
  return (
    <div data-page-layout="report" {...stylex.props(styles.root)}>
      <PageContent>{summary}</PageContent>
      {breakdown}
    </div>
  );
}

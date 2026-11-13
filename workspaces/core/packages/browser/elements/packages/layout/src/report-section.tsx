import type { ReactElement, ReactNode } from 'react';
import { Stack } from '../../core/src/index.ts';

export type ReportSectionProps = { readonly summary: ReactElement; readonly children: ReactElement };

export function ReportSection({ summary, children }: ReportSectionProps): ReactNode {
  return (
    <Stack isCompact>
      {summary}
      {children}
    </Stack>
  );
}

import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';

export function ChartData({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(accessibility.hidden)}>{children}</div>;
}

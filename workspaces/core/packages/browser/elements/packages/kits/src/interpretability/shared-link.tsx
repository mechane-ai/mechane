import type { ReactNode } from 'react';
import { ChartLink, useChartLinkControl } from '../../../charts/src/index.ts';

/**
 * Puts a kit view's figures in one chart link, unless the view already sits in a link the page shares. A list and a map
 * on one page then light the same feature.
 */
export function SharedLink({ children }: { readonly children: ReactNode }): ReactNode {
  const outer = useChartLinkControl();

  return outer === undefined ? <ChartLink>{children}</ChartLink> : children;
}

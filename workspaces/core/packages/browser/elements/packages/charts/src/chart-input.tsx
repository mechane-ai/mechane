import type { ReactNode } from 'react';
import { Notice } from '../../feedback/src/index.ts';
import { ChartFrame } from './chart-frame.tsx';

export function isFiniteDomain(domain: readonly [number, number]): boolean {
  const hasFiniteBounds = Number.isFinite(domain[0]) && Number.isFinite(domain[1]);

  return hasFiniteBounds && Number.isFinite(domain[1] - domain[0]) && domain[0] < domain[1];
}

export function hasUniqueIds(records: ReadonlyArray<{ readonly id: string }>): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

export function ChartInputError({
  title,
  description,
  message,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly message: string;
}): ReactNode {
  return (
    <ChartFrame title={title} description={description}>
      <Notice hasError>{message}</Notice>
    </ChartFrame>
  );
}

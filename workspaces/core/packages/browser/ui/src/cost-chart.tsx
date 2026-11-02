import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';

export type CostSample = { readonly id: string; readonly label: string; readonly micros: number };

export function CostChart({ samples }: { readonly samples: ReadonlyArray<CostSample> }): ReactNode {
  const width = 680;
  const height = 110;
  const x = scaleBand<string>({ domain: samples.map((sample) => sample.id), range: [0, width], padding: 0.35 });

  const y = scaleLinear<number>({
    domain: [0, Math.max(1, ...samples.map((sample) => sample.micros))],
    range: [height - 10, 10],
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Model request costs in this turn">
      {samples.map((sample) => (
        <Bar
          key={sample.id}
          x={x(sample.id)}
          y={y(sample.micros)}
          width={x.bandwidth()}
          height={height - 10 - y(sample.micros)}
          fill="#176b60"
          rx={3}
        >
          <title>
            {sample.label}: ${(sample.micros / 1_000_000).toFixed(6)}
          </title>
        </Bar>
      ))}
    </svg>
  );
}

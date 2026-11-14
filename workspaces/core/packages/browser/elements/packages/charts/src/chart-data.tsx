import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { accessibility } from '../../foundations/src/accessibility.ts';

export type ChartDataRow = { readonly id: string | number; readonly values: ReadonlyArray<string> };

export type ChartDataProps = {
  readonly label: string;
  readonly columns: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly rows: ReadonlyArray<ChartDataRow>;
};

export function ChartData({ label, columns, rows }: ChartDataProps): ReactNode {
  return (
    <div {...stylex.props(accessibility.hidden)}>
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.id} scope="row">
                    {row.values[index]}
                  </th>
                ) : (
                  <td key={column.id}>{row.values[index]}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

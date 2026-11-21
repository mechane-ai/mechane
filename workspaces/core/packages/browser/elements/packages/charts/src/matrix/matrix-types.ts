export type MatrixAxisItem = {
  readonly id: string;
  /** The full name used in headers, inspection and exact values. */
  readonly label: string;
  /** A concise header, such as "J" for January, that a compact strip shows. Absent uses the label. */
  readonly axisLabel?: string | undefined;
};

export type MatrixCell = { readonly id: string; readonly rowId: string; readonly columnId: string } & (
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'masked'; readonly reason: string }
  | { readonly kind: 'missing'; readonly reason: string }
);

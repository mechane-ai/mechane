import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { tableStyles as styles } from './data-table-styles.ts';

const compactTableQuery = conditions.compactTable.slice('@media '.length);
const recordTextTypes: ReadonlySet<string> = new Set(['string', 'number']);

export type TableSizing = 'content' | 'fill';
export type RowSizing = 'fixed' | 'content';

export type DataTableColumnRole = 'primary' | 'text' | 'status' | 'number' | 'timestamp' | 'actions';

type ColumnGeometry = { readonly minimumWidth: number; readonly isFlexible: boolean; readonly shouldTruncate: boolean };

const columnGeometry = {
  primary: { minimumWidth: 240, isFlexible: true, shouldTruncate: true },
  text: { minimumWidth: 160, isFlexible: false, shouldTruncate: true },
  status: { minimumWidth: 160, isFlexible: false, shouldTruncate: false },
  number: { minimumWidth: 112, isFlexible: false, shouldTruncate: false },
  timestamp: { minimumWidth: 160, isFlexible: false, shouldTruncate: false },
  actions: { minimumWidth: 112, isFlexible: false, shouldTruncate: false },
} satisfies Record<DataTableColumnRole, ColumnGeometry>;

export const cellSizingStyles = { fixed: styles.content, content: styles.contentCell } satisfies Record<
  RowSizing,
  stylex.StyleXStyles
>;

export const columnRoleStyles = {
  primary: styles.start,
  text: styles.start,
  status: styles.start,
  number: styles.end,
  timestamp: styles.end,
  actions: styles.end,
} satisfies Record<DataTableColumnRole, stylex.StyleXStyles>;

export const frameStyles = { content: styles.content, fill: styles.fillFrame } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

export const viewportStyles = { content: styles.content, fill: styles.fillViewport } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

export type DataTableColumnLayout = {
  readonly id: string;
  readonly label: string;
  readonly role: DataTableColumnRole;
  readonly width?: number;
  readonly isSecondary?: boolean;
};

export type DataTableColumn<Row> = DataTableColumnLayout & {
  readonly cell: (row: Row) => ReactNode;
  readonly shouldTruncate?: boolean;
  readonly canSort?: boolean;
};

export function prepareColumns<Column extends DataTableColumnLayout>(columns: ReadonlyArray<Column>) {
  return columns.map((column) => {
    const geometry = columnGeometry[column.role];
    const width = column.width ?? (geometry.isFlexible ? undefined : geometry.minimumWidth);

    return { ...column, ...(width === undefined ? {} : { width }) };
  });
}

export function tableWidths(columns: ReadonlyArray<DataTableColumnLayout>, selectionWidth = 0) {
  const minimumWidth = columns.reduce(
    (total, column) => total + (column.width ?? columnGeometry[column.role].minimumWidth),
    selectionWidth,
  );

  const compactWidth = columns
    .filter((column) => column.isSecondary !== true)
    .reduce((total, column) => total + (column.width ?? columnGeometry[column.role].minimumWidth), selectionWidth);

  return { minimumWidth, compactWidth };
}

export function subscribeToCompactTable(onChange: () => void): () => void {
  const query = globalThis.matchMedia(compactTableQuery);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

export function isCompactTable(): boolean {
  return globalThis.matchMedia(compactTableQuery).matches;
}

export function ColumnGroup({
  columns,
  canSelect = false,
}: {
  readonly columns: ReadonlyArray<DataTableColumnLayout>;
  readonly canSelect?: boolean;
}): ReactNode {
  return (
    <colgroup>
      {canSelect && <col {...stylex.props(styles.selection)} />}
      {columns.map((column) => (
        <col
          key={column.id}
          {...stylex.props(
            column.width !== undefined && styles.width(column.width),
            column.isSecondary === true && styles.secondary,
          )}
        />
      ))}
    </colgroup>
  );
}

export function TableCellContent({
  role,
  isFixed,
  shouldTruncate,
  children,
}: {
  readonly role: DataTableColumnRole;
  readonly isFixed: boolean;
  readonly shouldTruncate: boolean | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const geometry = columnGeometry[role];
  const shouldTruncateByDefault = isFixed && geometry.shouldTruncate;
  const isTruncated = typeof children === 'string' && (shouldTruncate ?? shouldTruncateByDefault);

  return (
    <span {...stylex.props(styles.cellViewport, !isFixed && styles.contentViewport)}>
      <span
        data-record-text={recordTextTypes.has(typeof children) || undefined}
        title={typeof children === 'string' ? children : undefined}
        {...stylex.props(
          styles.cellContent,
          isFixed && styles.fixedContent,
          isFixed && !geometry.shouldTruncate && styles.readable,
          isTruncated && styles.truncated,
        )}
      >
        {children}
      </span>
    </span>
  );
}

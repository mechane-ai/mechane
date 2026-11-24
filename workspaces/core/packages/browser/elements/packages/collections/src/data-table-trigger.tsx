import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { Tooltip } from '../../overlays/src/index.ts';
import { tableStyles as styles } from './data-table-styles.ts';
import { TableRowButton, TableRowLink } from './table-results.tsx';

export type DataTableRowAction<Row> = {
  readonly label?: (row: Row) => string;
  /** Show a hover tooltip repeating `label`. Defaults to false; `label` always provides `aria-label`. */
  readonly showTooltip?: boolean;
} & (
  | { readonly href: (row: Row) => string; readonly onActivate?: (row: Row) => void; readonly disabled?: never }
  | ({ readonly href?: never; readonly onActivate: (row: Row) => void } & Pick<ComponentProps<'button'>, 'disabled'>)
);

function isPlainActivation(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  const hasCommandModifier = event.metaKey || event.ctrlKey;
  const hasAlternateModifier = event.altKey || event.shiftKey;

  if (hasCommandModifier || hasAlternateModifier) {
    return false;
  }

  return event.detail === 0 || event.currentTarget.ownerDocument.getSelection()?.isCollapsed !== false;
}

type RowTriggerProps<Row> = {
  /** The row's position among the supplied rows, which the table's one Tab stop moves by. */
  readonly index: number;
  readonly recordId: string;
  readonly row: Row;
  readonly action: DataTableRowAction<Row>;
  readonly isActive: boolean;
  readonly children: ReactNode;
};

/** A row's primary link or button. It covers the row's plain cells, and the rows share one Tab stop. */
export function RowTrigger<Row>({ index, recordId, row, action, isActive, children }: RowTriggerProps<Row>): ReactNode {
  const label = action.label?.(row);

  const trigger =
    action.href === undefined ? (
      <TableRowButton
        value={recordId}
        row={index}
        col={0}
        type="button"
        disabled={action.disabled === true}
        aria-label={label}
        aria-pressed={isActive}
        data-row-action
        onClick={(event) => {
          if (isPlainActivation(event)) {
            action.onActivate(row);
          }
        }}
        {...stylex.props(styles.trigger)}
      >
        {children}
      </TableRowButton>
    ) : (
      <TableRowLink
        value={recordId}
        row={index}
        col={0}
        aria-label={label}
        href={action.href(row)}
        data-row-action
        onClick={(event) => {
          if (action.onActivate !== undefined && isPlainActivation(event)) {
            event.preventDefault();
            action.onActivate(row);
          }
        }}
        {...stylex.props(styles.trigger)}
      >
        {children}
      </TableRowLink>
    );

  if (label === undefined || action.showTooltip !== true) {
    return trigger;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Popup side="top" align="start">
        {label}
      </Tooltip.Popup>
    </Tooltip.Root>
  );
}

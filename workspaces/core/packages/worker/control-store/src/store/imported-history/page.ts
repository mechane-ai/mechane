import { StoreConflict } from '../errors.ts';

const MAXIMUM_HISTORY_ROWS = 200;

export function validateHistoryRows(maxRows: number): void {
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAXIMUM_HISTORY_ROWS) {
    throw new StoreConflict('Imported history page exceeds its bounds');
  }
}

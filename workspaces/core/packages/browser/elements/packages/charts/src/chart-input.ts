/** Whether every record has its own id. Charts refuse input that repeats one. */
export function hasUniqueIds(records: ReadonlyArray<{ readonly id: string }>): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

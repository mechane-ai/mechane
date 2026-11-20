/**
 * Bounds one presentation so Slack and Console accept the same content. Renderers must validate before storing or
 * displaying it.
 */
export const PRESENTATION_LIMITS = {
  elements: 40,
  depth: 8,
  serializedBytes: 49_152,
  textChars: 3000,
  titleChars: 150,
  labelChars: 75,
  urlChars: 2048,
  fallbackChars: 12_000,
  fields: 10,
  fieldChars: 2000,
  actions: 5,
  tables: 1,
  tableRows: 20,
  tableColumns: 6,
  tableChars: 10_000,
  charts: 1,
  chartSeries: 5,
  chartPoints: 20,
  chartLabelChars: 20,
  chartTitleChars: 50,
} as const;

/** Additional files required at the root of every local archive. */
export const LOCAL_NOTICES = [
  'LICENSE',
  'NOTICE',
  'licenses',
  'CELLD-LICENSE',
  'CELLD-NOTICE',
  'model.example.json',
] as const;

/** Read and execute permissions for users of the extracted runtime. */
export const EXECUTABLE_MODE = 0o755;

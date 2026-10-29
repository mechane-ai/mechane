/** The workspace cap bounds owner configuration and grant discovery. */
export const CONNECTIONS_PER_WORKSPACE = 64;
/** The tool selection cap bounds grants and request validation. */
export const TOOLS_PER_CONNECTION = 64;
/** Remote names are bounded before discovery and exact matching. */
export const TOOL_NAME_MAX_CHARS = 128;
/** Secret references are bounded configuration keys, never credential values. */
export const SECRET_REFERENCE_MAX_CHARS = 128;
/** The remote URL length cap bounds owner-supplied connection configuration. */
export const REMOTE_URL_MAX_CHARS = 2048;
/** Only owner-classified free reads are supported until paid or mutating calls have receipt semantics. */
export const RemoteToolPolicy = { ReadOnlyFree: 'read_only_free' } as const;
export type RemoteToolPolicy = (typeof RemoteToolPolicy)[keyof typeof RemoteToolPolicy];

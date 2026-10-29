/** Repository content access levels requested from the GitHub App installation. */
export const GITHUB_TOKEN_PERMISSION = { Read: 'read', Write: 'write' } as const;
/** One of the installation token access levels the source workflow requests. */
export type GitHubTokenPermission = (typeof GITHUB_TOKEN_PERMISSION)[keyof typeof GITHUB_TOKEN_PERMISSION];

/**
 * The paths of GitHub's OAuth web flow and user API that a sign-in calls, below the deployment's GitHub web and API
 * origins; the local stack's GitHub serves the same paths.
 */
export const GitHubPath = {
  Authorize: '/login/oauth/authorize',
  AccessToken: '/login/oauth/access_token',
  User: '/user',
} as const;

export type GitHubPath = (typeof GitHubPath)[keyof typeof GitHubPath];

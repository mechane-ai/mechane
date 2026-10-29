/**
 * The paths of the pages a browser opens, which no client calls; they are fixed because the production GitHub OAuth App
 * registers the callback's URL.
 */
export const PagePath = {
  Home: '/',
  Device: '/device',
  GitHubCallback: '/auth/github/callback',
  LocalSignIn: '/auth/local',
} as const;

export type PagePath = (typeof PagePath)[keyof typeof PagePath];

/**
 * The steps of the device page's form: a signed-in browser reviews the approval of the code its person typed, and then
 * approves that approval from the review.
 */
export const DeviceStep = { Review: 'review', Approve: 'approve' } as const;

export type DeviceStep = (typeof DeviceStep)[keyof typeof DeviceStep];

/** The device page's field in which a person types the code their terminal shows. */
export const TYPED_CODE_FIELD = 'code';

/** The longest code the device page's form takes, well past a code with spaces around it. */
export const TYPED_CODE_MAX_CHARS = 32;

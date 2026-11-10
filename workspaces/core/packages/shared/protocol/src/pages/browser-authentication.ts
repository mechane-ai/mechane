/** The browser and server share these paths to coordinate session changes. */
export const BrowserAuthenticationPath = {
  SignIn: '/auth/sign-in',
  Callback: '/auth/github/callback',
  SignOut: '/auth/sign-out',
  Script: '/console/auth-session.js',
} as const;

/** The server requires this value in its custom header to refuse ordinary form POSTs. */
export const BROWSER_AUTHENTICATION_REQUEST = '1';

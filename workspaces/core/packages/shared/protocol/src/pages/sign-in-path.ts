type SignInPathInput = { readonly returnTo: string };

/** The Node sign-in owner validates this same-origin destination before preserving it through OAuth. */
export function signInPath({ returnTo }: SignInPathInput): string {
  const query = new URLSearchParams({ returnTo });

  return `/auth/sign-in?${query.toString()}`;
}

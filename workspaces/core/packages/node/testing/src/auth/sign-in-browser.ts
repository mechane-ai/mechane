import { HttpStatusCode } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { createBrowser } from './browser.ts';
import type { SmokeBrowser } from './types.ts';

type SignInInput = { readonly stack: LocalStack; readonly login: string };

export async function signInBrowser({ stack, login }: SignInInput): Promise<SmokeBrowser> {
  const github = stack.fixtures?.github;

  if (github === undefined) {
    throw new Error('The authentication smoke requires the local GitHub service');
  }

  const browser = createBrowser([stack.origin, github.origin]);
  const signIn = new URL('/auth/sign-in', stack.origin);

  signIn.searchParams.set('returnTo', '/device');

  const page = await browser.request({ url: signIn });

  if (page.status !== HttpStatusCode.Ok || page.url.origin !== github.origin.origin) {
    throw new Error('Sign-in did not reach the configured GitHub service');
  }

  const returned = await browser.submit({ page, fields: { login } });

  if (returned.status !== HttpStatusCode.Ok || returned.url.origin !== stack.origin.origin) {
    throw new Error('GitHub sign-in did not establish a browser session');
  }

  return browser;
}

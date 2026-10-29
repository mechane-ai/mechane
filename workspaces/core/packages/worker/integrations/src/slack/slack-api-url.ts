import type { SlackApiMethod } from './constants.ts';

type SlackApiUrlInput = { readonly origin: URL; readonly method: SlackApiMethod };
type SlackApiPathInput = Pick<SlackApiUrlInput, 'method'>;

/** The configured provider origin combined with a known Slack API method. */
export function slackApiUrl({ origin, method }: SlackApiUrlInput): URL {
  const pathname = slackApiPath({ method });

  return new URL(pathname, origin);
}

function slackApiPath({ method }: SlackApiPathInput): string {
  return `/api/${method}`;
}

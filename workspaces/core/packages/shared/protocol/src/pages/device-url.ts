import type { SecureOrigin } from '@mechane/deployment';
import { PagePath } from './constants.ts';

type DeviceUrlInput = { readonly origin: SecureOrigin };

/**
 * The device page on the deployment's origin, the URL a person opens to approve a code. It carries no code: the page
 * asks for the code once GitHub signed the browser in, so no link can carry one to a person who did not start it.
 */
export function deviceUrl({ origin }: DeviceUrlInput): URL {
  return new URL(PagePath.Device, origin);
}

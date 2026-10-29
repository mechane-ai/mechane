import type { SecureOrigin } from '@mechane/deployment';
import { INSTALL_SCRIPT_PATH } from './constants.ts';

type InstallScriptUrlInput = { readonly origin: SecureOrigin };

/** The install script on a deployment's origin, which installs the release its latest manifest names. */
export function installScriptUrl({ origin }: InstallScriptUrlInput): URL {
  return new URL(INSTALL_SCRIPT_PATH, origin);
}

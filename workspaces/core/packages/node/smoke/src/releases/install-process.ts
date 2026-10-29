import { CliVariable } from '@mechane/program';
import type { StartProcessInput } from '@mechane/program';
import { installScriptUrl } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { INSTALL_TIMEOUT } from './constants.ts';

type InstallProcessInput = { readonly stack: Stack; readonly folder: string };

/** The install script the stack serves, piped from curl to sh as a person runs it, installing into `folder`. */
export function installProcess({ stack, folder }: InstallProcessInput): StartProcessInput {
  const installerUrl = installScriptUrl({ origin: stack.origin });

  return {
    command: 'sh',
    args: ['-c', 'curl -fsS "$1" | sh', 'sh', installerUrl.href],
    environment: { ...stack.settings.inherited, [CliVariable.InstallFolder]: folder },
    timeout: INSTALL_TIMEOUT,
  };
}

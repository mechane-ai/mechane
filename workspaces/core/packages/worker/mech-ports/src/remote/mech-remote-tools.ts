import type { RemoteTools } from '@mechane/harness-tools';
import { callGrantedTool } from './call-granted-tool.ts';
import { listGrantedTools } from './list-granted-tools.ts';
import { readRemotePortOutcome } from './read-remote-port-outcome.ts';
import type { MechRemoteToolsInput } from './types.ts';

/** Binds the mech's live workspace authority behind sanitized tool outcomes. */
export function mechRemoteTools({ store, settings }: MechRemoteToolsInput): RemoteTools {
  const list: RemoteTools['list'] = (input) => {
    const promise = listGrantedTools({ store, settings, ...input });

    return readRemotePortOutcome({ promise });
  };

  const call: RemoteTools['call'] = (input) => {
    const promise = callGrantedTool({ store, settings, ...input });

    return readRemotePortOutcome({ promise });
  };

  return { list, call };
}

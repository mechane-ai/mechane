import { defineExtension } from '@earendil-works/pi-durable';
import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';
import { reportFindingTool } from './findings/report-finding-tool.ts';
import type { MechFindings } from './findings/types.ts';
import { bashTool } from './hands/bash-tool.ts';
import { memoryExtension } from './memory/memory-extension.ts';
import type { MechMemory } from './memory/types.ts';
import { callRemoteTool } from './remote/call-remote-tool.ts';
import { listRemoteTools } from './remote/list-remote-tools.ts';
import type { RemoteTools } from './remote/types.ts';
import { threadsExtension } from './threads/threads-extension.ts';
import type { MechThreads } from './threads/types.ts';
import type { Hands } from './types.ts';

const REMOTE_EXTENSION = 'mechane.remote';

/** The extension that gives a mech's conversation its hands; every conversation selects every extension by default. */
const HANDS_EXTENSION = 'mechane.hands';

/** The ports a mech's extensions reach its sandboxes, its memory and its threads through. */
type MechExtensionsInput = {
  /** The mech's sandbox, which its bash tool runs commands in. */
  readonly hands: Hands;
  readonly remote: RemoteTools;
  readonly findings: MechFindings;
  /** The mech's memory, which its memory tools change and its memory section lists. */
  readonly memory: MechMemory;
  /** The mech's threads and drones, which its threads tools change and its threads section lists. */
  readonly threads: MechThreads;
};

/** The threads extension and tools that only the mech conversation may call. */
type DroneOmissions = { readonly threads: Extension; readonly rootTools: ReadonlyArray<ToolRegistration> };

/** The extensions a mech's Harness installs, and what a drone's conversation goes without. */
type MechTools = { readonly extensions: ReadonlyArray<Extension>; readonly selection: DroneOmissions };

/**
 * The extensions every conversation of a mech selects by default, its hands, its memory and its threads, and what a
 * drone's conversation leaves out of them. The mech passes them to its Harness, which never builds a tool.
 */
export function mechExtensions({ hands, memory, threads, remote, findings }: MechExtensionsInput): MechTools {
  const remembering = memoryExtension({ memory });
  const threading = threadsExtension({ threads });
  const remoteTools = [listRemoteTools({ remote }), callRemoteTool({ remote })];
  const findingTool = reportFindingTool({ findings });

  return {
    extensions: [
      defineExtension({ name: HANDS_EXTENSION, tools: [bashTool({ hands })] }),
      remembering.extension,
      threading,
      defineExtension({ name: REMOTE_EXTENSION, tools: remoteTools }),
      defineExtension({ name: 'mechane.findings', tools: [findingTool] }),
    ],
    selection: { threads: threading, rootTools: [...remembering.writingTools, ...remoteTools, findingTool] },
  };
}

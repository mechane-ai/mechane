import { defineExtension } from '@earendil-works/pi-durable';
import type { Extension } from '@earendil-works/pi-durable';
import { openThreadTool } from './open-thread-tool.ts';
import { startDroneTool } from './start-drone-tool.ts';
import { threadsSection } from './threads-section.ts';
import type { ThreadsInput } from './types.ts';
import { updateThreadTool } from './update-thread-tool.ts';

/**
 * The extension that gives a mech's conversation its threads and drones, which a drone's conversation leaves out. Its
 * name, its tools' names and its section's key are stored formats, since pi stores each.
 */
const THREADS_EXTENSION = 'mechane.threads';

/** The mech's threads as pi offers them: their tools, the drone they start, and their section. */
export function threadsExtension({ threads }: ThreadsInput): Extension {
  return defineExtension({
    name: THREADS_EXTENSION,
    tools: [openThreadTool({ threads }), updateThreadTool({ threads }), startDroneTool({ threads })],
    sections: [threadsSection({ threads })],
  });
}

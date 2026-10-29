import { defineExtension } from '@earendil-works/pi-durable';
import type { Extension, ToolRegistration } from '@earendil-works/pi-durable';
import { handoffTool } from './handoff-tool.ts';
import { memoryDeleteTool } from './memory-delete-tool.ts';
import { memoryReadTool } from './memory-read-tool.ts';
import { memorySection } from './memory-section.ts';
import { memoryWriteTool } from './memory-write-tool.ts';
import type { MemoryInput } from './types.ts';

/**
 * The extension that gives a mech's conversation its memory and its handoff. Every conversation selects every extension
 * by default, and pi stores its name, its tools' names and its section's key, so each is a stored format.
 */
const MEMORY_EXTENSION = 'mechane.memory';

/** The memory extension, and the tools of it that change memory or the context, which no drone is offered. */
type MemoryExtension = { readonly extension: Extension; readonly writingTools: ReadonlyArray<ToolRegistration> };

/**
 * The mech's memory as pi offers it: its tools, its section, and the handoff that resets the context to a note. It
 * names the tools a drone's conversation leaves out, so a drone only reads.
 */
export function memoryExtension({ memory }: MemoryInput): MemoryExtension {
  const writingTools = [memoryWriteTool({ memory }), memoryDeleteTool({ memory }), handoffTool()];

  return {
    extension: defineExtension({
      name: MEMORY_EXTENSION,
      tools: [memoryReadTool({ memory }), ...writingTools],
      sections: [memorySection({ memory })],
    }),
    writingTools,
  };
}

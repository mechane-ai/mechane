import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { MemoryDigest, MemoryPath } from '@mechane/protocol';
import { Result, Schema } from 'effect';
import { Type } from 'typebox';
import { MemoryDescription, MemoryTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import { memoryResult } from './memory-result.ts';
import { DigestParameter, MemoryDeletion, PathParameter } from './schemas.ts';
import type { MemoryInput } from './types.ts';

/** What the model passes to memory_delete: the path, and the digest of the memory it deletes. */
const MemoryDeleteParameters = Type.Object({ path: PathParameter, digest: DigestParameter });

/** The tool's arguments as it decodes them. */
const MemoryDeleteArguments = Schema.Struct({ path: MemoryPath, digest: MemoryDigest });

type MemoryDeleteArguments = typeof MemoryDeleteArguments.Type;

/** Deletes a memory for the running turn under the tool's task, as a write changes one, and replays as a write does. */
export function memoryDeleteTool({ memory }: MemoryInput): ToolRegistration<typeof MemoryDeleteParameters> {
  const execute: ToolRegistration<typeof MemoryDeleteParameters>['execute'] = async (args, api) => {
    const decoded = Schema.decodeUnknownResult(MemoryDeleteArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const { path, digest } = decoded.success;
    const outcome = await memory.change(MemoryDeletion.make({ taskId: api.taskId, path, expectedDigest: digest }));

    return memoryResult({ outcome, path });
  };

  return defineTool({
    name: MemoryTool.Delete,
    description: MemoryDescription.Delete,
    parameters: MemoryDeleteParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

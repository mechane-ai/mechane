import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { MemoryDigest, MemoryPath, MemoryText } from '@mechane/protocol';
import { sha256Hex } from '@mechane/utilities';
import { Result, Schema } from 'effect';
import { Type } from 'typebox';
import { MemoryDescription, MemoryTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import { memoryResult } from './memory-result.ts';
import { DigestParameter, MemoryWrite, PathParameter } from './schemas.ts';
import type { MemoryInput } from './types.ts';

/** What the model passes to memory_write: the path, the text, and the digest of the memory it replaces, if any. */
const MemoryWriteParameters = Type.Object({
  path: PathParameter,
  text: Type.String({ description: 'The text to save; its first line summarizes it in your memory section' }),
  digest: Type.Optional(DigestParameter),
});

/** The tool's arguments as it decodes them. */
const MemoryWriteArguments = Schema.Struct({
  path: MemoryPath,
  text: MemoryText,
  /** The digest of the memory the write replaces; none to create one. */
  digest: Schema.OptionFromOptionalKey(MemoryDigest),
});

type MemoryWriteArguments = typeof MemoryWriteArguments.Type;

/**
 * Writes a memory for the running turn under the tool's task, which awaits its transaction before it returns. So the
 * change lands before the call settles, and so before its turn can end. After a restart, pi may run it again, and the
 * task's recorded change answers the rerun.
 */
export function memoryWriteTool({ memory }: MemoryInput): ToolRegistration<typeof MemoryWriteParameters> {
  const execute: ToolRegistration<typeof MemoryWriteParameters>['execute'] = async (args, api) => {
    const decoded = Schema.decodeUnknownResult(MemoryWriteArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const { path, text, digest } = decoded.success;

    const outcome = await memory.change(
      MemoryWrite.make({ taskId: api.taskId, path, text, digest: await sha256Hex({ text }), expectedDigest: digest }),
    );

    return memoryResult({ outcome, path });
  };

  return defineTool({
    name: MemoryTool.Write,
    description: MemoryDescription.Write,
    parameters: MemoryWriteParameters,
    replay: 'safe',
    executionMode: 'sequential',
    execute,
  });
}

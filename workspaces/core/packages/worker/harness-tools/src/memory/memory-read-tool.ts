import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import { MEMORY_TEXT_MAX_BYTES, MemoryPath } from '@mechane/protocol';
import { Option, Result, Schema } from 'effect';
import { Type } from 'typebox';
import { conversationRole } from '../conversation-role.ts';
import { textResult } from '../text-result.ts';
import { MemoryDescription, MemoryTool } from './constants.ts';
import { invalidResult } from './invalid-result.ts';
import { memoryResult } from './memory-result.ts';
import { MemoryChangeOutcome, PathParameter } from './schemas.ts';
import type { MemoryInput, TurnMemory } from './types.ts';

/** The lines of header a read shows above a memory's text. */
const READ_HEADER_LINES = 3;

/** The most lines a read shows: a memory of nothing but line breaks, below the read's header. */
const READ_MAX_LINES = READ_HEADER_LINES + MEMORY_TEXT_MAX_BYTES + 1;

/** What the model passes to memory_read: the path to read. */
const MemoryReadParameters = Type.Object({ path: PathParameter });

/** The tool's arguments as it decodes them. */
const MemoryReadArguments = Schema.Struct({ path: MemoryPath });

type MemoryReadArguments = typeof MemoryReadArguments.Type;

type ReadTextInput = { readonly path: string; readonly found: TurnMemory };

/**
 * Reads one memory as the calling conversation sees it, the running turn's or a drone's. The read has no effect, so pi
 * may run it again after a restart.
 */
export function memoryReadTool({ memory }: MemoryInput): ToolRegistration<typeof MemoryReadParameters> {
  const execute: ToolRegistration<typeof MemoryReadParameters>['execute'] = async (args, api, context) => {
    const decoded = Schema.decodeUnknownResult(MemoryReadArguments)(args);

    if (Result.isFailure(decoded)) {
      return invalidResult({ issue: decoded.failure.message });
    }

    const { path } = decoded.success;
    const role = await conversationRole({ read: api, conversationId: api.conversationId, context });
    const found = await memory.read({ path, role });

    if (Option.isNone(found)) {
      return memoryResult({ outcome: MemoryChangeOutcome.cases.Missing.make({}), path });
    }

    return textResult({ text: readText({ path, found: found.value }) });
  };

  return defineTool({
    name: MemoryTool.Read,
    description: MemoryDescription.Read,
    parameters: MemoryReadParameters,
    replay: 'safe',
    executionMode: 'sequential',
    outputLimits: { maxLines: READ_MAX_LINES },
    execute,
  });
}

/** The memory with its path and digest above it, and whether only the turn's own change holds it so far. */
function readText({ path, found }: ReadTextInput): string {
  if (found.isSaved) {
    return `${path}\ndigest: ${found.digest}\n\n${found.text}`;
  }

  return `${path} (changed in this turn, saved once it ends with a reply)\ndigest: ${found.digest}\n\n${found.text}`;
}

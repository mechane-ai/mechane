import { Effect, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_FOLDER } from '../constants.ts';
import { decodeFile } from '../decode-file.ts';
import type { InputUnreadable } from '../errors.ts';

/** The boundaries check writes this graph; readers share its path and decoded format. */
export const MODULE_GRAPH = join(CACHE_FOLDER, 'module-graph.json');

const ModuleGraph = Schema.Record(Schema.String, Schema.Array(Schema.String));

export type ModuleGraph = typeof ModuleGraph.Type;

/** A missing cruise leaves no module edges; callers retain their conservative fallback. */
export const readModuleGraph = Effect.fn('readModuleGraph')(function* (): Effect.fn.Return<
  ModuleGraph,
  InputUnreadable
> {
  if (!existsSync(MODULE_GRAPH)) {
    return {};
  }

  return yield* decodeFile({ path: MODULE_GRAPH, schema: ModuleGraph });
});

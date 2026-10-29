// These comment-only modules retain the dependency notices in every Worker bundle.
import '../../../../licenses/apache-2.0.js';
import '../../../../licenses/cfworker-json-schema.js';
import '../../../../licenses/content-type.js';
import '../../../../licenses/cookie.js';
import '../../../../licenses/effect.js';
import '../../../../licenses/eventsource-parser.js';
import '../../../../licenses/jose.js';
import '../../../../licenses/model-context-protocol.js';
import '../../../../licenses/openai.js';
import '../../../../licenses/partial-json.js';
import '../../../../licenses/pi.js';
import '../../../../licenses/pkce-challenge.js';
import '../../../../licenses/typebox.js';
import '../../../../licenses/zod.js';
import type { WorkerEnvironment } from '@mechane/rpc';
import { Effect } from 'effect';
import { serve } from './serve.ts';

export { DirectoryObject } from '@mechane/directory';
export { SandboxObject, EgressGateway } from '@mechane/sandbox';
export { KeyCacheObject } from '@mechane/key-cache';
export { LimiterObject } from '@mechane/limiter';
export { MechObject } from '@mechane/mech';
export { WorkspaceObject } from '@mechane/workspace';

/** The Worker's entry point, which the Workers runtime loads as `main`. */
export default {
  async fetch(request, environment): Promise<Response> {
    return await Effect.runPromise(serve({ request, environment }));
  },
} satisfies ExportedHandler<WorkerEnvironment>;

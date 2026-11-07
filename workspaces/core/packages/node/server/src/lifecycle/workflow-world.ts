import type { RuntimeConfiguration } from '@mechane/runtime';
import { getQueueTopicPrefix } from '@workflow/world';
import { createWorld } from '@workflow/world-postgres';
import { Record, Redacted, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { healthCheck, setWorld } from 'workflow/runtime';

const WORKFLOW_CONCURRENCY = 4;
const WORKFLOW_CONNECTIONS = 8;
const JOB_LOCK_STALE_SECONDS = 30;
const STARTUP_PROBE_TIMEOUT_MS = 30_000;
const DefinitionSchema = Schema.Struct({ workflowId: Schema.NonEmptyString });

const ManifestSchema = Schema.Struct({
  workflows: Schema.Record(Schema.String, Schema.Record(Schema.String, DefinitionSchema)),
});

type FlowHandler = (request: Request) => Promise<Response>;
// The immutable Workflow compiler output owns this signature; the module URL is never supplied by a caller.
// ast-grep-ignore: type-predicate
const HandlerSchema = Schema.declare<FlowHandler>((value): value is FlowHandler => typeof value === 'function');
const FlowModuleSchema = Schema.Struct({ POST: HandlerSchema });

type WorkflowWorldInput = { readonly configuration: RuntimeConfiguration; readonly artifactUrl: URL };
export type WorkflowWorld = ReturnType<typeof createWorld>;
export type WorkflowHost = { readonly world: WorkflowWorld; readonly workflowDefinitionId: string };

export async function startWorkflowHost({ world }: Pick<WorkflowHost, 'world'>): Promise<void> {
  await world.start();

  const probe = await healthCheck(world, { timeout: STARTUP_PROBE_TIMEOUT_MS });

  if (!probe.healthy) {
    throw new Error('The Workflow queue did not complete its startup probe');
  }
}

async function workflowDefinitionId({ artifactUrl }: Pick<WorkflowWorldInput, 'artifactUrl'>): Promise<string> {
  const manifestUrl = new URL('workflow/manifest.json', artifactUrl);
  const text = await readFile(manifestUrl, 'utf8');
  const manifest = Schema.decodeUnknownSync(ManifestSchema)(JSON.parse(text));

  const definitions = Record.values(manifest.workflows).flatMap((exports) => {
    const definition = exports['runWorkflow'];

    if (definition === undefined) {
      return [];
    }

    return [definition.workflowId];
  });

  if (definitions.length !== 1) {
    throw new Error('The runtime artifact must contain exactly one runWorkflow definition');
  }

  return Schema.decodeUnknownSync(Schema.NonEmptyString)(definitions[0]);
}

export async function createWorkflowHost({ configuration, artifactUrl }: WorkflowWorldInput): Promise<WorkflowHost> {
  const definitionId = await workflowDefinitionId({ artifactUrl });

  const world = createWorld({
    connectionString: Redacted.value(configuration.databaseUrl),
    maxPoolSize: WORKFLOW_CONNECTIONS,
    queueConcurrency: WORKFLOW_CONCURRENCY,
    jobPrefix: 'mechane_',
    jobLockStaleSeconds: JOB_LOCK_STALE_SECONDS,
    applicationManagedShutdown: true,
  });

  setWorld(world);

  try {
    const flowUrl = new URL('workflow/flow.mjs', artifactUrl);
    const imported: unknown = await import(flowUrl.href);
    const flow = Schema.decodeUnknownSync(FlowModuleSchema)(imported);
    const prefix = getQueueTopicPrefix('workflow');

    world.registerHandler(prefix, flow.POST);

    return { world, workflowDefinitionId: definitionId };
  } catch (error) {
    await world.close?.();
    setWorld(undefined);

    throw error;
  }
}

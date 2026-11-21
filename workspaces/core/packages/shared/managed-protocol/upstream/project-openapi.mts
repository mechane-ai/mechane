import { Order, Record, Schema } from 'effect';

const OpenApi = Schema.Struct({
  paths: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
  components: Schema.Struct({ schemas: Schema.Record(Schema.String, Schema.MutableJson) }),
});
const Parameter = Schema.Struct({ in: Schema.String, name: Schema.String, schema: Schema.MutableJson });
const Operation = Schema.Struct({
  operationId: Schema.String,
  parameters: Schema.optionalKey(Schema.Array(Parameter)),
  requestBody: Schema.optionalKey(
    Schema.Struct({ content: Schema.Record(Schema.String, Schema.Struct({ schema: Schema.MutableJson })) }),
  ),
});
const decodeOpenApi = Schema.decodeUnknownSync(Schema.fromJsonString(OpenApi));
const decodeOperation = Schema.decodeUnknownSync(Operation);
const hasOperationId = Schema.is(Schema.Struct({ operationId: Schema.String }));
const annotation = new Set(['description', 'title', 'example', 'examples', 'discriminator', 'default']);
const managedPath =
  /^(\/v1\/(?:agents|environments|files|sessions|skills|vaults|memory_stores)(?:\/[^?]*)?)\?beta=true$/u;
const classifiedPath =
  /^(\/v1\/(?:agents|environments|sessions|skills|vaults|memory_stores|deployments|deployment_runs|dreams|files|tunnels|user_profiles)(?:\/[^?]*)?)(\?beta=true)?$/u;
const propertyTables: ReadonlySet<string> = new Set(['properties', 'patternProperties']);
const schemaPrefix = '#/components/schemas/';
const workerTools = ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write'];

type Json = Schema.MutableJson;
type Definitions = Readonly<Record<string, Json>>;
type Route = {
  readonly method: string;
  readonly path: string;
  readonly operation: string;
  readonly query: Definitions;
  readonly body: Json;
  readonly multipart: boolean;
};

type CompatibilityStatus = 'implemented' | 'excluded_self_hosted';

type CompatibilityEntry = {
  readonly method: string;
  readonly path: string;
  readonly beta: boolean;
  readonly operation: string;
  readonly status: CompatibilityStatus;
  readonly reason: string;
};

function requiredSchema(schemas: Definitions, name: string): Json {
  const value = schemas[name];

  if (value === undefined || !Record.has(schemas, name)) {
    throw new Error(`Missing OpenAPI schema ${name}`);
  }

  return value;
}

function object(value: Json | undefined): Schema.MutableJsonObject {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an OpenAPI schema object');
  }

  return value;
}

type Projection = { readonly definitions: Map<string, Json>; readonly project: (value: Json) => Json };

function projectSchemas(schemas: Definitions): Projection {
  const definitions = new Map<string, Json>();

  function project(value: Json): Json {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(project);
    }

    const result: Record<string, Json> = {};

    for (const [key, child] of Record.toEntries(value)) {
      if (key === '$ref') {
        if (typeof child !== 'string' || !child.startsWith(schemaPrefix)) {
          throw new Error('Expected an OpenAPI component schema reference');
        }

        const name = child.slice(schemaPrefix.length);

        if (!definitions.has(name)) {
          // Reserve the name before following a recursive component reference.
          definitions.set(name, null);
          definitions.set(name, project(requiredSchema(schemas, name)));
        }

        result[key] = `#/$defs/${name}`;
      } else if (propertyTables.has(key)) {
        // A property can itself be named `description` or `default`.
        result[key] = Record.map(object(child), project);
      } else if (!annotation.has(key) && !key.startsWith('x-')) {
        result[key] = project(child);
      }
    }

    return result;
  }

  return { definitions, project };
}

function selfHostedFields(definitions: Map<string, Json>): void {
  // The self-hosted server accepts both MCP identity modes on the hosted SDK's URL server shape.
  const urlServer = object(object(definitions.get('BetaManagedAgentsURLMCPServerParams'))['properties']);
  const audience = { type: 'string', minLength: 1 };
  urlServer['auth'] = {
    type: 'object',
    additionalProperties: false,
    required: ['type', 'audience'],
    properties: { type: { const: 'agent_token' }, audience },
  };
  urlServer['agent_token_header'] = {
    type: 'object',
    additionalProperties: false,
    required: ['audience'],
    properties: { audience },
  };

  // Session overrides use null to clear a collection inherited from the pinned agent.
  const overrides = object(object(definitions.get('BetaManagedAgentsAgentWithOverridesParams'))['properties']);

  for (const key of ['tools', 'skills', 'mcp_servers']) {
    overrides[key] = { anyOf: [requiredSchema(overrides, key), { type: 'null' }] };
  }
}

type ManagedSchemas = {
  readonly requests: { readonly routes: ReadonlyArray<Route>; readonly definitions: Definitions };
  readonly inputs: Definitions;
  readonly matrix: ReadonlyArray<CompatibilityEntry>;
};

function exclusionReason(path: string, isBeta: boolean): string {
  if (path.startsWith('/v1/deployments') || path.startsWith('/v1/deployment_runs')) {
    return 'Scheduled deployments are excluded from Anthropic self-hosted Managed Agents; installations own recurring triggers.';
  }

  if (path.startsWith('/v1/dreams')) {
    return 'Dreams are excluded from Anthropic self-hosted Managed Agents.';
  }

  if (path.startsWith('/v1/files') && !isBeta) {
    return 'Managed Agents serves files through the beta routes with the files-api or managed-agents beta header.';
  }

  if (path.startsWith('/v1/tunnels')) {
    return 'Hosted tunnels are excluded from Anthropic self-hosted Managed Agents.';
  }

  if (path.startsWith('/v1/user_profiles')) {
    return 'User profiles are hosted-only and excluded from Anthropic self-hosted Managed Agents.';
  }

  if (path.startsWith('/v1/skills') && !isBeta) {
    return 'Managed Agents serves skills through the beta routes with the managed-agents beta header.';
  }

  throw new Error(`Unclassified upstream operation path: ${path}`);
}

export function projectManagedSchemas(source: string): ManagedSchemas {
  const spec = decodeOpenApi(source);
  const schemas = spec.components.schemas;
  const { definitions, project } = projectSchemas(schemas);
  const routes: Array<Route> = [];
  const matrix: Array<CompatibilityEntry> = [];

  for (const [key, methods] of Record.toEntries(spec.paths)) {
    const match = managedPath.exec(key);
    const classified = classifiedPath.exec(key);

    if (classified !== null && classified[1] !== undefined) {
      const path = classified[1];
      const isBeta = classified[2] === '?beta=true';
      const isImplemented = match !== null;

      for (const [method, input] of Record.toEntries(methods).filter(([, value]) => hasOperationId(value))) {
        const operation = decodeOperation(input);
        const upperMethod = method.toUpperCase();
        let status: CompatibilityStatus = 'implemented';
        let reason = 'Implemented in the published self-hosted Managed Agents profile.';

        if (!isImplemented) {
          status = 'excluded_self_hosted';
          reason = exclusionReason(path, isBeta);
        }

        matrix.push({ method: upperMethod, path, beta: isBeta, operation: operation.operationId, status, reason });

        if (isImplemented) {
          const query: Record<string, Json> = {};

          for (const parameter of operation.parameters ?? []) {
            if (parameter.in === 'query') {
              query[parameter.name] = project(parameter.schema);
            }
          }

          const { content = {} } = operation.requestBody ?? {};
          const { schema = null } = content['application/json'] ?? {};
          routes.push({
            method: upperMethod,
            path,
            operation: operation.operationId,
            query,
            body: project(schema),
            multipart: Record.has(content, 'multipart/form-data'),
          });
        }
      }
    }
  }

  selfHostedFields(definitions);

  const sorted = Record.fromEntries([...definitions].toSorted(([first], [second]) => Order.String(first, second)));

  const sortedMatrix = matrix.toSorted((left, right) => {
    const byOperation = Order.String(left.operation, right.operation);

    if (byOperation !== 0) {
      return byOperation;
    }

    return Order.String(left.path, right.path);
  });

  const inputs = Record.fromEntries(
    workerTools.map((name) => [
      name.toLowerCase(),
      requiredSchema(schemas, `BetaManagedAgentsAgentToolset20260401_${name}Input`),
    ]),
  );

  return { requests: { routes, definitions: sorted }, inputs, matrix: sortedMatrix };
}

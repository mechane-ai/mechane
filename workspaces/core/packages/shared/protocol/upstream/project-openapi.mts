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
const managedPath = /^(\/v1\/(?:agents|environments|sessions|skills|vaults|memory_stores)(?:\/[^?]*)?)\?beta=true$/u;
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
};

export function projectManagedSchemas(source: string): ManagedSchemas {
  const spec = decodeOpenApi(source);
  const schemas = spec.components.schemas;
  const { definitions, project } = projectSchemas(schemas);
  const routes: Array<Route> = [];

  for (const [key, methods] of Record.toEntries(spec.paths)) {
    const match = managedPath.exec(key);

    if (match !== null && match[1] !== undefined) {
      const path = match[1];

      for (const [method, input] of Record.toEntries(methods).filter(([, value]) => hasOperationId(value))) {
        const operation = decodeOperation(input);
        const query: Record<string, Json> = {};

        for (const parameter of operation.parameters ?? []) {
          if (parameter.in === 'query') {
            query[parameter.name] = project(parameter.schema);
          }
        }

        const { content = {} } = operation.requestBody ?? {};
        const { schema = null } = content['application/json'] ?? {};
        routes.push({
          method: method.toUpperCase(),
          path,
          operation: operation.operationId,
          query,
          body: project(schema),
          multipart: Record.has(content, 'multipart/form-data'),
        });
      }
    }
  }

  selfHostedFields(definitions);

  const sorted = Record.fromEntries([...definitions].toSorted(([first], [second]) => Order.String(first, second)));

  const inputs = Record.fromEntries(
    workerTools.map((name) => [
      name.toLowerCase(),
      requiredSchema(schemas, `BetaManagedAgentsAgentToolset20260401_${name}Input`),
    ]),
  );

  return { requests: { routes, definitions: sorted }, inputs };
}

import { managedRequestDefinitions } from '@mechane/protocol';
import type { ManagedHttpRoute } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Function, Option, Predicate, Record } from 'effect';
import { z } from 'zod';
import { ManagedHttpError } from './http-error.ts';

type JsonSchema = Readonly<Record<string, unknown>>;
type QueryEntry = readonly [string, string];
type SchemaInput = { readonly schema: JsonSchema; readonly value: unknown; readonly field: string };
type BodyInput = { readonly route: ManagedHttpRoute; readonly raw: unknown };
type QueryInput = { readonly route: ManagedHttpRoute; readonly query: ReadonlyArray<QueryEntry> };
type Parameter = { readonly schema: JsonSchema; readonly key: string; readonly entries: ReadonlyArray<QueryEntry> };

const queryBooleans: ReadonlySet<string> = new Set(['true', 'false']);

const validatorFor = Function.memoize((schema: JsonSchema) =>
  z.fromJSONSchema({ ...schema, $defs: managedRequestDefinitions }),
);

function validate({ schema, value, field }: SchemaInput): void {
  const validator = validatorFor(schema);
  const parsed = validator.safeParse(value);

  if (parsed.success) {
    return;
  }

  const [issue] = parsed.error.issues;

  if (issue !== undefined && issue.path.length > 0) {
    const path = issue.path.join('.');

    throw new ManagedHttpError(HttpStatusCode.BadRequest, `Invalid ${field} at ${path}`);
  }

  throw new ManagedHttpError(HttpStatusCode.BadRequest, `Invalid ${field}`);
}

export function decodeManagedBody({ route, raw }: BodyInput): JsonSchema {
  if (!Predicate.isReadonlyObject(raw)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Expected a JSON object');
  }

  if (Option.isSome(route.body)) {
    validate({ schema: route.body.value, value: raw, field: 'request body' });
  } else if (Record.keys(raw).length > 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'This operation takes no body');
  }

  return raw;
}

function queryType(schema: JsonSchema): unknown {
  const variants = schema['anyOf'];

  if (typeof schema['type'] === 'string' || !Array.isArray(variants)) {
    return schema['type'];
  }

  const options: ReadonlyArray<unknown> = variants;

  for (const variant of options) {
    if (Predicate.isReadonlyObject(variant) && variant['type'] !== 'null') {
      return variant['type'];
    }
  }

  return undefined;
}

function queryValue({ schema, key, entries }: Parameter): unknown {
  const type = queryType(schema);

  if (type === 'array') {
    return entries.map(([, value]) => value);
  }

  const [entry] = entries;

  if (entries.length !== 1 || entry === undefined) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, `Duplicate query parameter ${key}`);
  }

  const [, value] = entry;

  if (type === 'integer' && /^-?\d+$/u.test(value)) {
    return Number(value);
  }

  if (type === 'boolean' && queryBooleans.has(value)) {
    return value === 'true';
  }

  return value;
}

export function decodeManagedQuery({ route, query }: QueryInput): JsonSchema {
  const fields = query.filter(([key, value]) => key !== 'beta' || value !== 'true');
  const groups = Map.groupBy(fields, ([key]) => key);
  const result: Record<string, unknown> = {};

  for (const [key, entries] of groups) {
    const schema = route.query[key];

    if (!Record.has(route.query, key) || schema === undefined) {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, `Unknown query parameter ${key}`);
    }

    const value = queryValue({ schema, key, entries });

    validate({ schema, value, field: key });

    result[key] = value;
  }

  return result;
}

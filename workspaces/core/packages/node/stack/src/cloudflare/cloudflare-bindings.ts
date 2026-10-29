import { WORKER_VARIABLES } from '@mechane/deployment';
import type { BaseConfiguration } from '@mechane/wrangler';
import { Option, Record } from 'effect';
import type { MiniflareBinding, MiniflareWorkerConfig } from 'miniflare';
import type { StackVariables } from '../types.ts';
import type { RuntimeConfiguration } from './schemas.ts';

type CloudflareBindingsInput = {
  readonly base: BaseConfiguration;
  readonly variables: StackVariables;
  readonly runtime: RuntimeConfiguration;
};

type CloudflareBindings = Pick<MiniflareWorkerConfig, 'env' | 'exports'>;

/** Every local binding is derived from the shipped Wrangler configuration. */
export function cloudflareBindings({ base, variables, runtime }: CloudflareBindingsInput): CloudflareBindings {
  const bindings: Record<string, MiniflareBinding> = {};
  const exports: NonNullable<MiniflareWorkerConfig['exports']> = {};

  for (const [name, value] of Record.toEntries(base.vars)) {
    bindings[name] = { type: 'text', value };
  }

  for (const [field, name] of Record.toEntries(WORKER_VARIABLES)) {
    const value = Option.fromNullishOr(variables[field]);

    if (Option.isSome(value)) {
      bindings[name] = { type: 'text', value: value.value };
    }
  }

  for (const binding of runtime.durable_objects.bindings) {
    bindings[binding.name] = { type: 'durable-object', worker: base.name, exportName: binding.class_name };
    exports[binding.class_name] = { type: 'durable-object', storage: 'sqlite' };
  }

  for (const bucket of base.r2_buckets) {
    bindings[bucket.binding] = { type: 'r2', name: bucket.bucket_name };
  }

  return { env: bindings, exports };
}

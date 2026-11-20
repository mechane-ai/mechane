import type { Model, SimpleStreamOptions, StreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/anthropic-messages';
import { Schema, Struct } from 'effect';
import { publicClaudeId } from '../models/managed-offers.ts';
import { supportsManagedSystemMessages } from '../models/managed-system-message.ts';
import type { ManagedModelOptions } from '../models/model-effort.ts';

const object = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const betas = Schema.is(Schema.Array(Schema.String));
const unknownArray = Schema.is(Schema.Array(Schema.Unknown));
const fastBetaModels: ReadonlySet<string> = new Set(['claude-opus-4-8', 'claude-opus-4-6']);
const fastBeta = 'fast-mode-2026-02-01';
const webFetchBeta = 'web-fetch-2025-09-10';
const webFetchType = 'web_fetch_20250910';

type Invocation = {
  readonly model: Model<'anthropic-messages'>;
  readonly transcript: TranscriptContext;
  readonly settings: StreamOptions | SimpleStreamOptions;
  readonly isSimple: boolean;
  readonly modelOptions: ManagedModelOptions;
  readonly webTools?: ReadonlyArray<Readonly<Record<string, unknown>>> | undefined;
};

function mergeBetas(previous: unknown, additions: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (additions.length === 0) {
    return undefined;
  }

  const existing = previous ?? [];

  if (!betas(existing)) {
    throw new Error('The model adapter could not apply request betas');
  }

  return [...new Set([...existing, ...additions])];
}

export function streamManagedAnthropic({
  model,
  transcript,
  settings,
  isSimple,
  modelOptions,
  webTools = [],
}: Invocation) {
  const onPayload: NonNullable<StreamOptions['onPayload']> = async (payload, activeModel) => {
    const params = (await settings.onPayload?.(payload, activeModel)) ?? payload;

    if (!object(params)) {
      throw new Error('The model adapter could not construct a Messages request');
    }

    const request: Record<string, unknown> = { ...Struct.omit(params, ['speed']) };

    if (modelOptions.speed !== undefined) {
      request['speed'] = modelOptions.speed;
    }

    if (modelOptions.effort !== undefined) {
      const configuration = request['output_config'];

      if (configuration !== undefined && !object(configuration)) {
        throw new Error('The model adapter could not apply the selected effort');
      }

      request['output_config'] = { ...configuration, effort: modelOptions.effort };
    }

    const requiredBetas: Array<string> = [];
    const id = (publicClaudeId(model.id) ?? model.id).replace(/-\d{8}$/u, '');

    if (modelOptions.speed === 'fast' && fastBetaModels.has(id)) {
      requiredBetas.push(fastBeta);
    }

    if (webTools.length > 0) {
      const existing = request['tools'];

      if (existing !== undefined && !unknownArray(existing)) {
        throw new Error('The model adapter could not attach managed web tools');
      }

      request['tools'] = [...(existing ?? []), ...webTools];

      if (webTools.some((tool) => tool['type'] === webFetchType)) {
        requiredBetas.push(webFetchBeta);
      }
    }

    const merged = mergeBetas(request['betas'], requiredBetas);

    if (merged !== undefined) {
      request['betas'] = merged;
    }

    return request;
  };

  const nativeModel = {
    ...model,
    compat: { ...model.compat, supportsMidConvoSystemMessages: supportsManagedSystemMessages(model.id) },
  };

  if (isSimple) {
    return streamSimple(nativeModel, transcript, { ...settings, onPayload });
  }

  return stream(nativeModel, transcript, { ...settings, onPayload });
}

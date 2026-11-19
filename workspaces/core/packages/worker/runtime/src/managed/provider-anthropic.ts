import type { Model, SimpleStreamOptions, StreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/anthropic-messages';
import { Schema, Struct } from 'effect';
import { publicClaudeId } from '../models/managed-offers.ts';
import { supportsManagedSystemMessages } from '../models/managed-system-message.ts';
import type { ManagedModelOptions } from '../models/model-effort.ts';

const object = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const betas = Schema.is(Schema.Array(Schema.String));
const fastBetaModels: ReadonlySet<string> = new Set(['claude-opus-4-8', 'claude-opus-4-6']);
const fastBeta = 'fast-mode-2026-02-01';

type Invocation = {
  readonly model: Model<'anthropic-messages'>;
  readonly transcript: TranscriptContext;
  readonly settings: StreamOptions | SimpleStreamOptions;
  readonly isSimple: boolean;
  readonly modelOptions: ManagedModelOptions;
};

export function streamManagedAnthropic({ model, transcript, settings, isSimple, modelOptions }: Invocation) {
  const onPayload: NonNullable<StreamOptions['onPayload']> = async (payload, activeModel) => {
    const params = (await settings.onPayload?.(payload, activeModel)) ?? payload;

    if (!object(params)) {
      throw new Error('The model adapter could not construct a Messages request');
    }

    const request = { ...Struct.omit(params, ['speed']) };

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

    const id = (publicClaudeId(model.id) ?? model.id).replace(/-\d{8}$/u, '');

    if (modelOptions.speed === 'fast' && fastBetaModels.has(id)) {
      const previous = request['betas'] ?? [];

      if (!betas(previous)) {
        throw new Error('The model adapter could not apply the selected fast mode');
      }

      request['betas'] = [...new Set([...previous, fastBeta])];
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

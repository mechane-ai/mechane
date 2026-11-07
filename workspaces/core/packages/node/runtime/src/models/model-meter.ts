import type { LanguageModelV4CallOptions, LanguageModelV4Usage } from '@ai-sdk/provider';
import { FatalError, getStepMetadata } from 'workflow';
import type { ModelOffer } from '../config.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { boundModelSpend, priceModelUsage } from './model-pricing.ts';
import type { ModelReference } from './model-reference.ts';

export type ModelRequest = { readonly id: string; readonly reservedMicros: number; readonly offer: ModelOffer };

type ReserveInput = {
  readonly reference: ModelReference;
  readonly options: LanguageModelV4CallOptions;
  readonly offer: ModelOffer;
};

type SettleInput = { readonly request: ModelRequest; readonly usage: LanguageModelV4Usage | null };

export async function reserveModelRequest({ reference, options, offer }: ReserveInput): Promise<ModelRequest> {
  const step = getStepMetadata();
  const id = `${reference.runId}:${step.stepId}`;
  const reservedMicros = boundModelSpend({ offer, options });

  const saved = await withRuntimeStore((store) =>
    store.reserveModelSpend({
      id,
      runId: reference.runId,
      workspaceId: reference.workspaceId,
      mechId: reference.mechId,
      model: reference.modelId,
      reservedMicros,
    }),
  );

  if (saved.reservation.state === 'refused') {
    throw new FatalError('The current run or daily budget does not allow another model request');
  }

  if (!saved.wasCreated) {
    throw new FatalError('A previous model request has an uncertain outcome and will not be repeated');
  }

  return { id, reservedMicros, offer };
}

export async function settleModelRequest({ request, usage }: SettleInput): Promise<void> {
  if (usage !== null) {
    const priced = priceModelUsage({ offer: request.offer, usage });

    if (priced !== null) {
      await withRuntimeStore((store) =>
        store.settleModelSpend({ id: request.id, actualMicros: priced.micros, usage: priced.usage }),
      );

      return;
    }
  }

  // Missing provider usage must not turn a possibly paid request into free budget.
  await withRuntimeStore((store) =>
    store.settleModelSpend({ id: request.id, actualMicros: request.reservedMicros, usage: null }),
  );
}

import { FatalError } from 'workflow';
import { loadRuntimeConfiguration } from '../config.ts';
import { MAXIMUM_WORKING_CONTEXT_BYTES } from '../domain.ts';
import type { ContextWindow } from './context-window.ts';
import type { ModelReference } from './model-reference.ts';

const CONTEXT_OVERHEAD_TOKENS = 4096;
const MINIMUM_AVAILABLE_TOKENS = 8192;
const CONTEXT_TRIGGER_FRACTION = 0.7;
const SUMMARY_INPUT_FRACTION = 0.5;
const SUMMARY_MAX_OUTPUT_TOKENS = 4096;

export async function loadContextWindow(reference: ModelReference): Promise<ContextWindow> {
  'use step';

  const offer = loadRuntimeConfiguration().model.offers.find((candidate) => candidate.id === reference.modelId);

  if (offer === undefined) {
    throw new FatalError('The selected model is unavailable.');
  }

  const available = offer.contextWindowTokens - offer.maxOutputTokens - CONTEXT_OVERHEAD_TOKENS;

  if (available < MINIMUM_AVAILABLE_TOKENS) {
    throw new FatalError('The selected model has insufficient room for a durable coding conversation.');
  }

  return {
    triggerBytes: Math.min(Math.floor(available * CONTEXT_TRIGGER_FRACTION), MAXIMUM_WORKING_CONTEXT_BYTES),
    summaryInputBytes: Math.floor(available * SUMMARY_INPUT_FRACTION),
    summaryOutputTokens: Math.min(SUMMARY_MAX_OUTPUT_TOKENS, offer.maxOutputTokens),
  };
}

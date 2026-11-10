import { Schema } from 'effect';

export const StoreConflict = class StoreConflictError extends Error {
  override readonly name = 'StoreConflictError';
  readonly code = 'StoreConflict';
};

export const RecordNotFound = class RecordNotFoundError extends Error {
  override readonly name = 'RecordNotFoundError';
  readonly code = 'RecordNotFound';
};

export class ProviderDispatchRefused extends Schema.TaggedError<ProviderDispatchRefused>()('ProviderDispatchRefused', {
  reason: Schema.Literals(['workspace_suspended', 'mech_disabled', 'workspace_allowance', 'mech_allowance']),
}) {}

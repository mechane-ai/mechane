export const StoreConflict = class StoreConflictError extends Error {
  override readonly name = 'StoreConflictError';
  readonly code = 'StoreConflict';
};

export const RecordNotFound = class RecordNotFoundError extends Error {
  override readonly name = 'RecordNotFoundError';
  readonly code = 'RecordNotFound';
};

export const AdmissionRefused = class AdmissionRefusedError extends Error {
  override readonly name = 'AdmissionRefusedError';
  readonly code = 'AdmissionRefused';
};

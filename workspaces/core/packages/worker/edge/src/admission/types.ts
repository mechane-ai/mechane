import type { WorkerSettings } from '@mechane/bindings';
import type { RawPathParams } from '../types.ts';

/** A request as admission reads it: its headers, and its path parameters before the operation decodes them. */
export type AdmitInput = {
  readonly request: Request;
  readonly params: RawPathParams;
  readonly settings: WorkerSettings;
};

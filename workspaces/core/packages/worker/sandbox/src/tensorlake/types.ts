import type { SandboxStore } from '@mechane/sandbox-store';
import type { Redacted } from 'effect';

/** Credentials stay in the Worker; the store binds one persistent VM to this sandbox. */
export type TensorlakeSettings = {
  readonly apiKey: Redacted.Redacted;
  readonly image: string;
  readonly name: string;
  readonly store: SandboxStore;
};

/** The project credential and provider identity used for read and resume requests. */
export type RemoteInput = { readonly apiKey: Redacted.Redacted; readonly name: string };

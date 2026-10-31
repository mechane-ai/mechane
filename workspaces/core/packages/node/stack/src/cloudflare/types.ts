import type { BaseConfiguration } from '@mechane/wrangler';
import type { StackVariables } from '../types.ts';

export type CloudflareOptionsInput = {
  readonly base: BaseConfiguration;
  readonly variables: StackVariables;
  readonly origin: URL;
  readonly contents: string;
  readonly stateFolder: string;
};

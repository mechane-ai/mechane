import type { BaseConfiguration } from '@mechane/wrangler';
import type { Request, Response } from 'miniflare';
import type { StackVariables } from '../types.ts';

/** An external provider fixture and the observations the runtime scenario asserts. */
export type TensorlakeFixture = {
  readonly inspect: (request: Request) => Response;
  readonly observe: (request: Request) => void;
  readonly redirect: () => void;
  readonly requests: () => ReadonlyArray<string>;
};

export type CloudflareOptionsInput = {
  readonly base: BaseConfiguration;
  readonly variables: StackVariables;
  readonly origin: URL;
  readonly contents: string;
  readonly stateFolder: string;
  readonly origins: ReadonlySet<string>;
  readonly provider: TensorlakeFixture;
};

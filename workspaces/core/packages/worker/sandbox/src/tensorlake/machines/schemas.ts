import { OriginProtocol } from '@mechane/deployment';
import { RecordText, RemoteSandboxId } from '@mechane/records';
import { Schema } from 'effect';
import { TensorlakeStatus } from '../constants.ts';

/** A private provider VM and its current image. */
export const Remote = Schema.Struct({
  id: RemoteSandboxId,
  image: RecordText,
  status: Schema.Enum(TensorlakeStatus),
  /** Null until the provider has a reachable guest endpoint. */
  sandbox_url: Schema.OptionFromNullOr(
    Schema.URLFromString.check(
      Schema.makeFilter(
        (url) => url.protocol === OriginProtocol.Secure && url.hostname.endsWith('.sandbox.tensorlake.ai'),
      ),
      Schema.makeFilter((url) => url.username === '' && url.password === '' && url.port === ''),
    ),
  ),
});

export type Remote = typeof Remote.Type;

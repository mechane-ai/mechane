import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Option, Schema } from 'effect';
import type { Redacted } from 'effect';
import { ProcessStatus, TensorlakePath } from '../constants.ts';
import { processUrl } from '../processes/process-url.ts';
import { tensorlakeAnswer } from '../tensorlake-answer.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';

const ProcessReceipt = Schema.Struct({ status: Schema.String, exit_code: Schema.optionalKey(Schema.Int) });

type RunMaintenanceProcessInput = {
  readonly apiKey: Redacted.Redacted;
  readonly origin: URL;
  readonly name: string;
  readonly command: string;
  readonly args: ReadonlyArray<string>;
};

/** Named processes reconcile a lost start response; a completed failure never reruns behind the caller's back. */
export async function runMaintenanceProcess({
  apiKey,
  origin,
  name,
  command,
  args,
}: RunMaintenanceProcessInput): Promise<Option.Option<number>> {
  const url = processUrl({ origin, machineId: name });
  const response = await tensorlakeRequest({ apiKey, url, init: {} });

  if (response.status === HttpStatusCode.NotFound) {
    const collection = new URL(TensorlakePath.Processes, origin);

    const body = JSON.stringify({
      name,
      command: '/bin/bash',
      args: ['-c', command, name, ...args],
      working_dir: '/home/node',
      user: 'node',
      restart: { policy: 'never' },
    });

    await tensorlakeRequest({ apiKey, url: collection, init: { method: HttpMethod.Post, body } });

    return Option.none();
  }

  const receipt = await tensorlakeAnswer({ response, schema: ProcessReceipt });

  if (receipt.status !== ProcessStatus.Exited) {
    return Option.none();
  }

  const code = Option.fromNullishOr(receipt.exit_code);

  const exitCode = Option.getOrElse(code, () => -1);

  return Option.some(exitCode);
}

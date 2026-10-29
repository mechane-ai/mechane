import { defineTool, ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { ToolRegistration } from '@earendil-works/pi-durable';
import type { ServiceFreeCodec } from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { TSchema } from 'typebox';
import { failedResult } from '../failed-result.ts';
import type { ToolResult } from '../types.ts';
import { RemoteDiagnostic } from './constants.ts';
import { remoteResult } from './remote-result.ts';
import type { RemoteToolRun } from './types.ts';

/** The model-visible output cap matches the transport result bound. */
const REMOTE_OUTPUT_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;

type DefineRemoteToolInput<Parameters extends TSchema, Arguments extends ServiceFreeCodec> = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Parameters;
  readonly argumentsSchema: Arguments;
  readonly invalidMessage: string;
  readonly run: RemoteToolRun<Arguments['Type']>;
};

type ExecuteRemoteToolInput<Arguments extends ServiceFreeCodec> = Pick<
  DefineRemoteToolInput<TSchema, Arguments>,
  'argumentsSchema' | 'invalidMessage' | 'run'
> & {
  readonly argumentsValue: unknown;
  /** None leaves cancellation to the fixed operation deadline. */
  readonly signal: Option.Option<AbortSignal>;
  readonly isRoot: boolean;
};

/** Every remote declaration shares root admission, decoded arguments, and bounded sanitized output. */
export function defineRemoteTool<Parameters extends TSchema, Arguments extends ServiceFreeCodec>({
  name,
  description,
  parameters,
  argumentsSchema,
  invalidMessage,
  run,
}: DefineRemoteToolInput<Parameters, Arguments>): ToolRegistration<Parameters> {
  const execute: ToolRegistration<Parameters>['execute'] = async (argumentsValue, api, context) => {
    const signal = Option.fromNullishOr(context.abortSignal);
    const isRoot = api.conversationId === ROOT_CONVERSATION_ID;

    return await executeRemoteTool({ argumentsValue, argumentsSchema, invalidMessage, run, signal, isRoot });
  };

  return defineTool({
    name,
    description,
    parameters,
    replay: 'safe',
    executionMode: 'sequential',
    outputLimits: { retain: 'head', maxBytes: REMOTE_OUTPUT_MAX_BYTES },
    execute,
  });
}

async function executeRemoteTool<Arguments extends ServiceFreeCodec>({
  argumentsValue,
  argumentsSchema,
  invalidMessage,
  run,
  signal,
  isRoot,
}: ExecuteRemoteToolInput<Arguments>): Promise<ToolResult> {
  if (!isRoot) {
    return failedResult({
      code: RemoteDiagnostic.Refused,
      message: 'Remote grants belong only to the mech conversation',
    });
  }

  const decoded = Schema.decodeUnknownResult(argumentsSchema)(argumentsValue);

  if (Result.isFailure(decoded)) {
    return failedResult({ code: RemoteDiagnostic.Invalid, message: invalidMessage });
  }

  const outcome = await run({ arguments: decoded.success, signal });

  return remoteResult({ outcome });
}

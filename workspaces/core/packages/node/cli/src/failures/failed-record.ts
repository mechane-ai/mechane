import type { FailureReport } from '@mechane/cli-kernel';
import { errorDetail, UnknownFailure } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import type { AnsweredFailure } from './types.ts';

type FailedRecordInput = { readonly failed: AnsweredFailure };

/**
 * The record of an error a deployment answered: its code, message and family, and its own fields under the wire's keys.
 * For a code this release does not know, the fields are as the deployment sent them.
 */
export function failedRecord({ failed }: FailedRecordInput): FailureReport['record'] {
  const { family, message, failure } = failed;

  if (Schema.is(UnknownFailure)(failure)) {
    return { ...failure.fields, family: Option.some(family), code: failure.code, message };
  }

  const detail = errorDetail({ failure, message });

  return { ...detail, family: Option.some(detail.family) };
}

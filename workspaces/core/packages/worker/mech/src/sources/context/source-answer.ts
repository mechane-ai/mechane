import type { SourceTask } from '@mechane/mech-store';
import { SourceAnswer } from '@mechane/rpc';
import { sourceSummary } from './source-summary.ts';

type SourceAnswerInput = { readonly source: SourceTask };

/** Returns the durable checkout and publication state without exposing credentials. */
export function sourceAnswer({ source }: SourceAnswerInput): SourceAnswer {
  const report = sourceSummary({ source });

  return SourceAnswer.cases.Found.make({ report });
}

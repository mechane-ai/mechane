import type { EntryId, EntryRecord } from '@earendil-works/pi-durable';
import { Option } from 'effect';
import { assistantMessages } from './assistant-messages.ts';
import { PiAnswerPart, PiSubmissionStatus } from './constants.ts';
import { ItemEnded } from './schemas.ts';
import type { InputRecord } from './types.ts';
import { unansweredEnd } from './unanswered-end.ts';

/** The input whose end is read, and the answer entries it may name. */
type SubmissionEndInput = { readonly record: InputRecord; readonly answers: ReadonlyMap<EntryId, EntryRecord> };

/** The answer entry pi named for an answered input, and the entries it may be among. */
type AnsweredEndInput = Pick<Extract<InputRecord, DoneStatus>, 'answer'> & {
  readonly answers: ReadonlyMap<EntryId, EntryRecord>;
};

/** The status of a submission pi answered. */
type DoneStatus = { readonly status: typeof PiSubmissionStatus.Done };

/**
 * How pi ended an input, an inbox item's or a drone's brief, none while it waits or runs. An answered input's reply is
 * the text of its answer entry, which the commit that settled it appended.
 */
export function submissionEnd({ record, answers }: SubmissionEndInput): Option.Option<ItemEnded> {
  switch (record.status) {
    case PiSubmissionStatus.Queued:
    case PiSubmissionStatus.Placed:
      return Option.none();
    case PiSubmissionStatus.Done:
      return Option.some(answeredEnd({ answer: record.answer, answers }));
    case PiSubmissionStatus.Unanswered:
      return Option.some(unansweredEnd({ reason: record.reason }));
  }
}

/** An answered input's end, whose reply is the text of its answer entry. */
function answeredEnd({ answer, answers }: AnsweredEndInput): ItemEnded {
  const entry = Option.getOrThrow(Option.fromNullishOr(answers.get(answer)));

  const texts = assistantMessages({ entry })
    .flatMap((message) => message.content)
    .filter((content) => content.type === PiAnswerPart.Text);

  return ItemEnded.cases.Answered.make({ reply: texts.map((content) => content.text).join('') });
}

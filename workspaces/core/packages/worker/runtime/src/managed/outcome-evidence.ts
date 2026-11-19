import type { ImageContent, TextContent } from '@earendil-works/pi-ai';
import type { Tx, UserInput } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { readManagedEvent } from './event-log/write.ts';
import { pdfBytes } from './pdf-attachment.ts';
import type { ManagedEvent } from './protocol.ts';
import { managedResultContent } from './tool-content.ts';

const EvidenceTextCharacters = 32_768;
const AttachmentBase64Characters = 4_194_304;
const Text = Schema.Struct({ type: Schema.Literal('text'), text: Schema.String });

function textContent(event: ManagedEvent | undefined): string {
  const value = event?.['content'];

  if (!Schema.is(Schema.Array(Schema.Unknown))(value)) {
    return '';
  }

  return value
    .filter(Schema.is(Text))
    .map((block) => block.text)
    .join('\n');
}

async function fileEvidence(transaction: Tx, id: string, resultId: string) {
  const result = await readManagedEvent(transaction, id, resultId);
  const callId = result?.['tool_use_id'];

  if (result === undefined || typeof callId !== 'string') {
    return null;
  }

  const call = await readManagedEvent(transaction, id, callId);
  const raw = call?.['input'];

  if (!Schema.is(Schema.Struct({ file_path: Schema.String }))(raw)) {
    return null;
  }

  return { path: raw.file_path, read: raw, parts: managedResultContent(result).output ?? [] };
}

type EvidenceBudget = { readonly text: number; readonly attachments: number };

function fileExcerpt(file: NonNullable<Awaited<ReturnType<typeof fileEvidence>>>, budget: EvidenceBudget) {
  const remaining = { ...budget };

  const content: Array<TextContent | ImageContent> = [
    { type: 'text', text: JSON.stringify({ file: file.path, read: file.read }) },
  ];

  for (const part of file.parts) {
    let attachment = pdfBytes(part);

    if (part.type === 'image') {
      attachment = part.data;
    }

    if (attachment !== undefined) {
      if (attachment.length > remaining.attachments) {
        content.push({
          type: 'text',
          text: 'The attachment exceeds the evaluator evidence budget; its contents are unavailable.',
        });
      } else {
        remaining.attachments -= attachment.length;

        content.push(part);
      }
    } else if (part.type === 'text') {
      const excerpt = part.text.slice(0, remaining.text);
      remaining.text -= excerpt.length;

      content.push({
        type: 'text',
        text: JSON.stringify({ contents: excerpt, truncated: part.text.length > excerpt.length }),
      });
    }
  }

  return { remaining, content };
}

type Request = {
  readonly work: { readonly evidence: ReadonlyArray<string>; readonly answerId: string };
  readonly description: string;
  readonly rubric: string;
};

export async function gradingInput(
  transaction: Tx,
  id: string,
  { work, description, rubric }: Request,
): Promise<UserInput> {
  const answer = await readManagedEvent(transaction, id, work.answerId);

  const content: Array<TextContent | ImageContent> = [
    { type: 'text', text: JSON.stringify({ task: description, rubric, answer: textContent(answer) }) },
  ];

  let budget = { text: EvidenceTextCharacters, attachments: AttachmentBase64Characters };

  for (const resultId of work.evidence.toReversed()) {
    const file = await fileEvidence(transaction, id, resultId);

    if (file !== null) {
      const excerpt = fileExcerpt(file, budget);
      budget = excerpt.remaining;

      content.push(...excerpt.content);
    }
  }

  return content;
}

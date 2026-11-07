import { cardToBlockKit, SlackFormatConverter } from '@chat-adapter/slack';
import { toCard } from '@json-render/chat';
import {
  PRESENTATION_COMPONENTS,
  PRESENTATION_LIMITS,
  PresentationSpecification,
  renderPresentationText,
} from '@mechane/protocol/presentation';
import { z } from 'zod';
import { formatSlackCard } from './format-slack-card.ts';

const TRUNCATION_NOTE = '\n\n_Response shortened. The complete response is available in Mechane._';

export const DeliveryContent = z.object({ text: z.string(), spec: PresentationSpecification.optional() });
export type DeliveryContent = z.infer<typeof DeliveryContent>;

type NativePayload = Readonly<Record<string, unknown>>;

export function slackDeliveryPayload({ text, spec }: DeliveryContent): NativePayload {
  const converter = new SlackFormatConverter();

  if (spec !== undefined) {
    const card = toCard(spec, { components: PRESENTATION_COMPONENTS, maxElements: PRESENTATION_LIMITS.elements });

    const formatted = formatSlackCard({ card });
    const fallback = renderPresentationText({ spec });
    const fallbackMarkdown = boundedText(fallback);

    if (formatted === null) {
      return converter.toSlackPayload({ markdown: fallbackMarkdown });
    }

    const fallbackText = converter.toResponseUrlText({ markdown: fallbackMarkdown });

    return { blocks: cardToBlockKit(formatted), text: boundedText(fallbackText) };
  }

  const markdown = boundedText(text);

  return converter.toSlackPayload({ markdown });
}

function boundedText(text: string): string {
  if (text.length <= PRESENTATION_LIMITS.fallbackChars) {
    return text;
  }

  return text.slice(0, PRESENTATION_LIMITS.fallbackChars - TRUNCATION_NOTE.length) + TRUNCATION_NOTE;
}

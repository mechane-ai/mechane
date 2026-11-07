import { SlackFormatConverter } from '@chat-adapter/slack';
import { PRESENTATION_LIMITS } from '@mechane/protocol/presentation';
import type { CardChild, CardElement } from 'chat';

type FormatCardInput = { readonly card: CardElement };
const BOLD_MARKUP_CHARS = 2;
const FIELD_MARKUP_CHARS = 3;

export function formatSlackCard({ card }: FormatCardInput): CardElement | null {
  const formatted = { ...card, children: card.children.map(formatCardChild) };

  if (!formatted.children.every(fitsSlackBlock)) {
    return null;
  }

  return formatted;
}

function fitsSlackBlock(child: CardChild): boolean {
  switch (child.type) {
    case 'text':
      if (child.style === 'bold') {
        return child.content.length + BOLD_MARKUP_CHARS <= PRESENTATION_LIMITS.textChars;
      }

      return child.content.length <= PRESENTATION_LIMITS.textChars;
    case 'fields':
      return child.children.every(
        (field) => field.label.length + field.value.length + FIELD_MARKUP_CHARS <= PRESENTATION_LIMITS.fieldChars,
      );
    case 'section':
      return child.children.every(fitsSlackBlock);
    case 'actions':
    case 'chart':
    case 'divider':
    case 'image':
    case 'link':
    case 'table':
    case 'text_input':
      return true;
  }
}

function formatCardChild(child: CardChild): CardChild {
  const converter = new SlackFormatConverter();

  switch (child.type) {
    case 'text':
      return { ...child, content: converter.toResponseUrlText({ markdown: child.content }) };
    case 'fields':
      return {
        ...child,
        children: child.children.map((field) => ({
          ...field,
          value: converter.toResponseUrlText({ markdown: field.value }),
        })),
      };
    case 'section':
      return { ...child, children: child.children.map(formatCardChild) };
    case 'actions':
    case 'chart':
    case 'divider':
    case 'image':
    case 'link':
    case 'table':
    case 'text_input':
      return child;
  }
}

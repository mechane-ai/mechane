import type { ImageContent, TextContent } from '@earendil-works/pi-ai';

type PdfAttachment = TextContent & { readonly managedPdfData: string };

export function pdfAttachment(encodedDocument: string): PdfAttachment {
  return { type: 'text', text: 'PDF attachment', managedPdfData: encodedDocument };
}

export function pdfBytes(part: TextContent | ImageContent): string | undefined {
  if (part.type === 'text' && 'managedPdfData' in part && typeof part.managedPdfData === 'string') {
    return part.managedPdfData;
  }

  return undefined;
}

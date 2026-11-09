import { JSONUIProvider, Renderer } from '@json-render/react';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { PresentationSpecification } from '@mechane/protocol/presentation';
import type { ReactNode } from 'react';
import { presentationRegistry } from './structured/registry.tsx';

type StructuredMessageProps = { readonly value: unknown; readonly fallback?: string; readonly isStreaming?: boolean };

export function StructuredMessage({ value, fallback, isStreaming = false }: StructuredMessageProps): ReactNode {
  const result = PresentationSpecification.safeParse(value);

  if (!result.success) {
    return <Markdown headingLevel={3}>{fallbackText(fallback, isStreaming)}</Markdown>;
  }

  return (
    <JSONUIProvider registry={presentationRegistry}>
      <Renderer spec={result.data} registry={presentationRegistry} loading={isStreaming} />
    </JSONUIProvider>
  );
}

function fallbackText(supplied: string | undefined, isStreaming: boolean): string {
  if (supplied !== undefined && supplied.trim().length > 0) {
    return supplied;
  }

  return isStreaming ? 'Preparing result…' : 'This result could not be displayed.';
}

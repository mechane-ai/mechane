import type { ReactNode } from 'react';
import { TextLink } from '../../core/src/index.ts';

export type ContentLinkProps = {
  readonly href?: string | undefined;
  readonly children: ReactNode;
  readonly title?: string | undefined;
};

const RELATIVE_URL_BASE = 'https://content.invalid';
const LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:']);

export function contentHref(value: string | undefined): string | undefined {
  if (value === undefined || !URL.canParse(value, RELATIVE_URL_BASE)) {
    return undefined;
  }

  const { protocol } = new URL(value, RELATIVE_URL_BASE);

  return LINK_PROTOCOLS.has(protocol) ? value : undefined;
}

export function ContentLink({ href, children, title }: ContentLinkProps): ReactNode {
  const destination = contentHref(href);

  if (destination === undefined || destination.length === 0) {
    return <span title={title}>{children}</span>;
  }

  return (
    <TextLink href={destination} title={title} rel="noreferrer noopener">
      {children}
    </TextLink>
  );
}

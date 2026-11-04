import type { ReactNode } from 'react';
import { Block } from 'streamdown';
import type { Components, ExtraProps } from 'streamdown';
import { markdownOptions } from './markdown-options.ts';

export type MarkdownPreviewProps = { readonly children: string };
type PreviewTextProps = ExtraProps & { readonly children?: ReactNode };

function PreviewText({ children }: PreviewTextProps): ReactNode {
  return <>{children} </>;
}

const components: Components = {
  p: PreviewText,
  li: PreviewText,
  h1: PreviewText,
  h2: PreviewText,
  h3: PreviewText,
  h4: PreviewText,
  h5: PreviewText,
  h6: PreviewText,
  blockquote: PreviewText,
  pre: PreviewText,
  code: ({ children }) => <>{children}</>,
  th: PreviewText,
  td: PreviewText,
  br: () => <> </>,
  img: ({ alt }) => <>{alt}</>,
};

export function MarkdownPreview({ children }: MarkdownPreviewProps): ReactNode {
  return (
    <Block
      {...markdownOptions}
      content={children}
      components={components}
      allowedElements={Object.keys(components)}
      unwrapDisallowed
      shouldParseIncompleteMarkdown={false}
      shouldNormalizeHtmlIndentation={false}
      isIncomplete={false}
      index={0}
    />
  );
}

import { getFiletypeFromFileName } from '@pierre/diffs';
import type { ThemedToken } from '@pierre/highlights';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { CopyValue } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../../foundations/src/use-scroll-tab-index.ts';
import { viewerStyles } from '../viewer-styles.ts';
import { useHighlightedCode } from './use-highlighted-code.ts';

export type CodeAnnotation = { readonly line: number; readonly content: ReactNode };
export type CodeSelection = { readonly start: number; readonly end?: number };

export type CodeBlockProps = {
  readonly code: string;
  readonly variant?: 'default' | 'embedded';
  readonly language?: string | undefined;
  readonly filename?: string | undefined;
  readonly isStreaming?: boolean;
  readonly shouldWrap?: boolean;
  readonly showLineNumbers?: boolean;
  readonly selectedLines?: CodeSelection;
  readonly annotations?: ReadonlyArray<CodeAnnotation>;
  readonly maxHeight?: number;
  readonly maxLines?: number;
};

const styles = stylex.create({
  viewport: (maxHeight: number) => ({ overflow: 'auto', maxHeight, containerType: 'inline-size' }),
  code: {
    margin: 0,
    paddingBlock: spacing.sm,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.bodyLineHeight,
    tabSize: 2,
    minWidth: 'max-content',
  },
  wrapped: { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  sourceText: { fontFamily: 'inherit' },
  line: { display: 'flex', minHeight: typography.bodyLineHeight },
  number: {
    display: 'inline-block',
    flexShrink: 0,
    width: '4ch',
    paddingInline: spacing.sm,
    textAlign: 'end',
    color: colors.muted,
    userSelect: 'none',
  },
  source: { display: 'block', flex: '1 1 auto', paddingInline: spacing.md, minWidth: 0 },
  selected: { backgroundColor: colors.accentSoft },
  token: (color: string) => ({ color }),
  italic: { fontStyle: 'italic' },
  bold: { fontWeight: typography.strongWeight },
  annotation: {
    display: 'block',
    boxSizing: 'border-box',
    position: 'sticky',
    insetInlineStart: 0,
    width: '100cqi',
    padding: spacing.md,
    backgroundColor: colors.canvas,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },
});

type CodeTokenProps = { readonly token: ThemedToken };
const MAX_PREVIEW_CHARACTERS = 200_000;

function CodeToken({ token }: CodeTokenProps): ReactNode {
  const fontFlags = token.fontStyle ?? 0;
  // oxlint-disable-next-line no-bitwise -- Pierre encodes italic and bold in a bit mask.
  const [isItalic, isBold] = [(fontFlags & 1) !== 0, (fontFlags & 2) !== 0];

  return (
    <span {...stylex.props(styles.token(token.color ?? colors.ink), isItalic && styles.italic, isBold && styles.bold)}>
      {token.content}
    </span>
  );
}

export function CodeBlock({
  code,
  variant = 'default',
  language,
  filename,
  isStreaming = false,
  shouldWrap = false,
  showLineNumbers = true,
  selectedLines,
  annotations = [],
  maxHeight = 400,
  maxLines = 2000,
}: CodeBlockProps): ReactNode {
  const sourceLanguage = language ?? (filename === undefined ? 'text' : getFiletypeFromFileName(filename));
  const result = useHighlightedCode(code, sourceLanguage);
  const scroll = useScrollTabIndex<HTMLDivElement>();
  const previewLines = code.slice(0, MAX_PREVIEW_CHARACTERS).split(/\r\n|\n|\r/u);
  const lines = previewLines.slice(0, Math.max(1, maxLines)).map((text, position) => ({ text, line: position + 1 }));
  const label = filename ?? sourceLanguage;
  const isEmbedded = variant === 'embedded';

  return (
    <section aria-label={filename ?? 'Code'} {...stylex.props(viewerStyles.root, isEmbedded && viewerStyles.embedded)}>
      <div {...stylex.props(viewerStyles.header, isEmbedded && viewerStyles.embeddedHeader)}>
        <span {...stylex.props(viewerStyles.label)}>
          {label}
          {isStreaming && !isEmbedded && ' · streaming'}
        </span>
        <CopyValue label={filename ?? 'code'} value={code} display={isEmbedded ? 'icon' : 'value'}>
          Copy
        </CopyValue>
      </div>
      <div
        ref={scroll.ref}
        role="region"
        aria-label={`${label} source`}
        tabIndex={scroll.tabIndex}
        {...stylex.props(viewerStyles.scrollRegion, styles.viewport(maxHeight))}
      >
        <pre {...stylex.props(styles.code, shouldWrap && styles.wrapped)}>
          <code {...stylex.props(styles.sourceText)}>
            {lines.map(({ text, line }) => {
              const tokens = result === undefined ? undefined : result.lines[line - 1];

              const isSelected =
                selectedLines === undefined
                  ? false
                  : line >= selectedLines.start && line <= (selectedLines.end ?? selectedLines.start);

              const annotation = annotations.find((entry) => entry.line === line);

              return (
                <span key={line}>
                  <span {...stylex.props(styles.line, isSelected && styles.selected)}>
                    {showLineNumbers && (
                      <span aria-hidden {...stylex.props(styles.number)}>
                        {line}
                      </span>
                    )}
                    <span {...stylex.props(styles.source)}>
                      {tokens === undefined
                        ? text
                        : tokens.map((token) => <CodeToken key={token.offset} token={token} />)}
                      {text.length === 0 && '\n'}
                    </span>
                  </span>
                  {annotation !== undefined && <span {...stylex.props(styles.annotation)}>{annotation.content}</span>}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
      {previewLines.length > lines.length && (
        <div {...stylex.props(viewerStyles.note)}>Additional lines omitted. Copy includes the complete source.</div>
      )}
      {code.length > MAX_PREVIEW_CHARACTERS && (
        <div {...stylex.props(viewerStyles.note)}>
          Preview limited to the first 200,000 characters. Copy includes the complete source.
        </div>
      )}
      {code.length === 0 && <div {...stylex.props(viewerStyles.note)}>No source text.</div>}
      {result !== undefined && result.hasFailed && (
        <div {...stylex.props(viewerStyles.note)}>Syntax highlighting unavailable. The source is shown unchanged.</div>
      )}
    </section>
  );
}

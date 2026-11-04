import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { defaultRehypePlugins, Streamdown, useIsCodeFenceIncomplete } from 'streamdown';
import type { Components } from 'streamdown';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { CodeBlock } from '../code/code-block.tsx';
import { contentHref, ContentLink } from '../content-link.tsx';

const styles = stylex.create({
  root: {
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    overflowWrap: 'anywhere',
  },
  paragraph: { marginBlock: spacing.sm },
  heading: { marginBlockStart: spacing.lg, marginBlockEnd: spacing.sm, fontWeight: 600 },
  title: { fontSize: typography.sectionSize, lineHeight: typography.sectionLineHeight },
  section: { fontSize: typography.inputSize, lineHeight: typography.bodyLineHeight },
  minor: { fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  list: { marginBlock: spacing.sm, paddingInlineStart: spacing.xl },
  listItem: { paddingInlineStart: spacing.xxs, marginBlock: spacing.xxs },
  inlineCode: {
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingBlock: spacing.xxs,
    paddingInline: spacing.xs,
    whiteSpace: 'break-spaces',
  },
  quote: {
    marginBlock: spacing.md,
    marginInline: 0,
    paddingInlineStart: spacing.md,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    color: colors.muted,
  },
  tableRegion: {
    overflowX: 'auto',
    marginBlock: spacing.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', textAlign: 'start' },
  cell: {
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    verticalAlign: 'top',
    textAlign: 'start',
  },
  header: { color: colors.muted, fontWeight: 500, backgroundColor: colors.canvas },
  rule: {
    marginBlock: spacing.lg,
    borderWidth: 0,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: colors.line,
  },
  image: { display: 'inline', color: colors.muted, fontStyle: 'italic' },
  checkbox: { accentColor: colors.ink, marginInlineEnd: spacing.xs },
  strong: { fontWeight: 600 },
  emphasis: { fontStyle: 'italic' },
  deleted: { textDecorationLine: 'line-through' },
});

export type MarkdownProps = { readonly children: string; readonly streaming?: boolean; readonly label?: string };
type MarkdownCodeProps = ComponentProps<'code'>;
const TEXT_NODE_TYPES: ReadonlySet<string> = new Set(['string', 'number']);

function isTextNode(value: ReactNode): value is string | number {
  return TEXT_NODE_TYPES.has(typeof value);
}

function CodeFence({ children, className }: MarkdownCodeProps): ReactNode {
  const isIncomplete = useIsCodeFenceIncomplete();
  const match = typeof className === 'string' ? /(?:^|\s)language-([^\s]+)/u.exec(className) : null;
  const language = match === null ? undefined : match[1];
  const parts = Children.toArray(children);

  if (!parts.every(isTextNode)) {
    return <code {...stylex.props(styles.inlineCode)}>{children}</code>;
  }

  return <CodeBlock code={parts.join('')} language={language} streaming={isIncomplete} />;
}

function safeUrl(value: string, key: string): string | undefined {
  if (key !== 'href') {
    return undefined;
  }

  return contentHref(value);
}

const components: Components = {
  p: ({ children }) => <p {...stylex.props(styles.paragraph)}>{children}</p>,
  h1: ({ children, id }) => (
    <h1 id={id} {...stylex.props(styles.heading, styles.title)}>
      {children}
    </h1>
  ),
  h2: ({ children, id }) => (
    <h2 id={id} {...stylex.props(styles.heading, styles.section)}>
      {children}
    </h2>
  ),
  h3: ({ children, id }) => (
    <h3 id={id} {...stylex.props(styles.heading, styles.minor)}>
      {children}
    </h3>
  ),
  h4: ({ children, id }) => (
    <h4 id={id} {...stylex.props(styles.heading, styles.minor)}>
      {children}
    </h4>
  ),
  h5: ({ children, id }) => (
    <h5 id={id} {...stylex.props(styles.heading, styles.minor)}>
      {children}
    </h5>
  ),
  h6: ({ children, id }) => (
    <h6 id={id} {...stylex.props(styles.heading, styles.minor)}>
      {children}
    </h6>
  ),
  ul: ({ children }) => <ul {...stylex.props(styles.list)}>{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} {...stylex.props(styles.list)}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li {...stylex.props(styles.listItem)}>{children}</li>,
  blockquote: ({ children }) => <blockquote {...stylex.props(styles.quote)}>{children}</blockquote>,
  code: ({ children, className }) => <CodeFence className={className}>{children}</CodeFence>,
  inlineCode: ({ children }) => <code {...stylex.props(styles.inlineCode)}>{children}</code>,
  a: ({ href, children, title }) => (
    <ContentLink href={href} title={title}>
      {children}
    </ContentLink>
  ),
  img: ({ alt }) => (
    <span {...stylex.props(styles.image)}>{alt !== undefined && alt.length > 0 ? `[Image: ${alt}]` : '[Image]'}</span>
  ),
  table: ({ children }) => (
    <div role="region" aria-label="Markdown table" tabIndex={0} {...stylex.props(styles.tableRegion)}>
      <table {...stylex.props(styles.table)}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th scope="col" {...stylex.props(styles.cell, styles.header)}>
      {children}
    </th>
  ),
  td: ({ children }) => <td {...stylex.props(styles.cell)}>{children}</td>,
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked ?? false}
      disabled
      aria-label="Task item"
      {...stylex.props(styles.checkbox)}
    />
  ),
  hr: () => <hr {...stylex.props(styles.rule)} />,
  strong: ({ children }) => <strong {...stylex.props(styles.strong)}>{children}</strong>,
  em: ({ children }) => <em {...stylex.props(styles.emphasis)}>{children}</em>,
  del: ({ children }) => <del {...stylex.props(styles.deleted)}>{children}</del>,
};

const rehypePlugins = Object.entries(defaultRehypePlugins)
  .filter(([name]) => name !== 'raw')
  .map(([, plugin]) => plugin);

const allowedElements = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
  'hr',
  'strong',
  'em',
  'del',
  'br',
  'sup',
  'sub',
  'section',
];

export function Markdown({ children, streaming = false, label }: MarkdownProps): ReactNode {
  return (
    <Streamdown
      {...stylex.props(styles.root)}
      aria-label={label}
      components={components}
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      animated={false}
      controls={false}
      linkSafety={{ enabled: false }}
      rehypePlugins={rehypePlugins}
      allowedElements={allowedElements}
      skipHtml
      urlTransform={safeUrl}
    >
      {children}
    </Streamdown>
  );
}

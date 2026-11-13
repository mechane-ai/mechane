import * as stylex from '@stylexjs/stylex';
import { Children, createContext, createElement, memo, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Streamdown, useIsCodeFenceIncomplete } from 'streamdown';
import type { Components } from 'streamdown';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../../foundations/src/use-scroll-tab-index.ts';
import { useVisibleMotion } from '../../../foundations/src/visible-motion.ts';
import { CodeBlock } from '../code/code-block.tsx';
import { ContentLink } from '../content-link.tsx';
import { viewerStyles } from '../viewer-styles.ts';
import { markdownOptions } from './markdown-options.ts';

const styles = stylex.create({
  root: {
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    fontSize: typography.bodySize,
    lineHeight: typography.proseLineHeight,
    fontWeight: typography.regularWeight,
    overflowWrap: 'anywhere',
  },
  block: {
    marginBlockStart: { 'default': spacing.sm, ':first-child': 0 },
    marginBlockEnd: { 'default': spacing.sm, ':last-child': 0 },
  },
  heading: {
    marginBlockStart: { 'default': spacing.lg, ':first-child': 0 },
    marginBlockEnd: { 'default': spacing.sm, ':last-child': 0 },
    fontWeight: typography.strongWeight,
  },
  title: { fontSize: typography.sectionSize, lineHeight: typography.sectionLineHeight },
  section: { fontSize: typography.inputSize, lineHeight: typography.bodyLineHeight },
  minor: { fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
  list: { paddingInlineStart: spacing.xl },
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
    marginInline: 0,
    paddingInlineStart: spacing.md,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    color: colors.muted,
  },
  tableRegion: {
    minWidth: 0,
    maxWidth: '100%',
    overflowX: 'auto',
    borderWidth: 1,
    borderBlockEndWidth: 0,
    borderStyle: 'solid',
    borderColor: colors.line,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'start',
    overflowWrap: 'normal',
    lineHeight: typography.bodyLineHeight,
  },
  cell: {
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
    verticalAlign: 'top',
    textAlign: 'start',
  },
  header: { color: colors.muted, fontWeight: typography.mediumWeight, backgroundColor: colors.canvas },
  rule: {
    marginBlock: spacing.lg,
    borderWidth: 0,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: colors.line,
  },
  checkbox: { accentColor: colors.ink, marginInlineEnd: spacing.xs },
  strong: { fontWeight: typography.strongWeight },
  muted: { color: colors.muted },
  emphasis: { fontStyle: 'italic' },
  deleted: { textDecorationLine: 'line-through' },
});

const toneStyles = { default: null, muted: styles.muted };
const weightStyles = { regular: null, strong: styles.strong };

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkdownProps = {
  readonly children: string;
  readonly isStreaming?: boolean;
  readonly label?: string;
  readonly headingLevel?: HeadingLevel;
  readonly tone?: 'default' | 'muted';
  readonly weight?: 'regular' | 'strong';
};

type MarkdownHeadingProps = ComponentProps<'h1'> & { readonly level: HeadingLevel };

const HeadingContext = createContext<HeadingLevel>(1);
const textMotion = { animation: 'fadeIn', duration: 160, stagger: 14, maxBacklogMs: 100 };

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

  return (
    <div {...stylex.props(styles.block)}>
      <CodeBlock code={parts.join('')} language={language} isStreaming={isIncomplete} />
    </div>
  );
}

function MarkdownHeading({ level, children, id }: MarkdownHeadingProps): ReactNode {
  const headingLevel = useContext(HeadingContext);
  const tagName = `h${Math.min(level + headingLevel - 1, 6)}`;
  const size = level === 1 ? styles.title : level === 2 ? styles.section : styles.minor;

  return createElement(tagName, { id, ...stylex.props(styles.heading, size) }, children);
}

function MarkdownTable({ children }: { readonly children?: ReactNode }): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();

  return (
    <div
      ref={scroll.ref}
      role="region"
      aria-label="Markdown table"
      tabIndex={scroll.tabIndex}
      {...stylex.props(viewerStyles.scrollRegion, styles.block, styles.tableRegion)}
    >
      <table {...stylex.props(styles.table)}>{children}</table>
    </div>
  );
}

const components: Components = {
  h1: (props) => <MarkdownHeading {...props} level={1} />,
  h2: (props) => <MarkdownHeading {...props} level={2} />,
  h3: (props) => <MarkdownHeading {...props} level={3} />,
  h4: (props) => <MarkdownHeading {...props} level={4} />,
  h5: (props) => <MarkdownHeading {...props} level={5} />,
  h6: (props) => <MarkdownHeading {...props} level={6} />,
  p: ({ children }) => <p {...stylex.props(styles.block)}>{children}</p>,
  ul: ({ children }) => <ul {...stylex.props(styles.block, styles.list)}>{children}</ul>,
  ol: ({ children, start }) => (
    <ol start={start} {...stylex.props(styles.block, styles.list)}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li {...stylex.props(styles.listItem)}>{children}</li>,
  blockquote: ({ children }) => <blockquote {...stylex.props(styles.block, styles.quote)}>{children}</blockquote>,
  code: ({ children, className }) => <CodeFence className={className}>{children}</CodeFence>,
  inlineCode: ({ children }) => <code {...stylex.props(styles.inlineCode)}>{children}</code>,
  a: ({ href, children, title }) => (
    <ContentLink href={href} title={title}>
      {children}
    </ContentLink>
  ),
  img: ({ src, alt, title }) => (
    <ContentLink href={typeof src === 'string' ? src : undefined} title={title}>
      {alt !== undefined && alt.length > 0 ? `Open image: ${alt}` : 'Open image'}
    </ContentLink>
  ),
  table: ({ children }) => <MarkdownTable>{children}</MarkdownTable>,
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

const allowedElements = [
  'p',
  'span',
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

export const Markdown = memo(
  ({
    children,
    isStreaming = false,
    label,
    headingLevel = 1,
    tone = 'default',
    weight = 'regular',
  }: MarkdownProps): ReactNode => {
    const { ref, isActive } = useVisibleMotion(isStreaming);

    return (
      <HeadingContext value={headingLevel}>
        <div ref={ref} data-streamdown-paused={isStreaming && !isActive ? '' : undefined}>
          <Streamdown
            {...markdownOptions}
            {...stylex.props(styles.root, toneStyles[tone], weightStyles[weight])}
            aria-label={label}
            components={components}
            mode={isStreaming ? 'streaming' : 'static'}
            isAnimating={isStreaming}
            animated={isStreaming ? textMotion : false}
            controls={false}
            linkSafety={{ enabled: false }}
            allowedElements={allowedElements}
          >
            {children}
          </Streamdown>
        </div>
      </HeadingContext>
    );
  },
);

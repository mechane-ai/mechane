import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import { Children, isValidElement } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { CodeBlock } from '../../../content/src/code/index.ts';
import { ContentLink } from '../../../content/src/link.ts';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { TeX } from '../article/index.ts';

const styles = stylex.create({
  paragraph: { marginBlock: spacing.lg },
  section: {
    marginBlockStart: spacing.xxl,
    marginBlockEnd: spacing.md,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
    fontWeight: typography.strongWeight,
    letterSpacing: typography.headingTracking,
    textWrap: 'balance',
    breakAfter: 'avoid',
  },
  subsection: {
    marginBlockStart: spacing.xl,
    marginBlockEnd: spacing.sm,
    fontSize: typography.sectionSize,
    lineHeight: typography.proseLineHeight,
    fontWeight: typography.mediumWeight,
    breakAfter: 'avoid',
  },
  list: { marginBlock: spacing.lg, paddingInlineStart: spacing.xl },
  item: { marginBlock: spacing.xs, paddingInlineStart: spacing.xxs },
  quote: {
    marginBlock: spacing.lg,
    marginInline: 0,
    paddingInlineStart: spacing.lg,
    borderInlineStartWidth: 2,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: colors.line,
    color: colors.muted,
  },
  inlineCode: {
    paddingBlock: spacing.xxs,
    paddingInline: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize,
  },
  codeBlock: { marginBlock: spacing.lg, minWidth: 0 },
  scroller: { marginBlock: spacing.lg, overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  headCell: {
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.ink,
    color: colors.muted,
    fontWeight: typography.strongWeight,
    textAlign: 'start',
  },
  cell: {
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    borderBlockEndWidth: 1,
    borderBlockEndStyle: 'solid',
    borderBlockEndColor: colors.line,
  },
  aligned: (textAlign: string) => ({ textAlign }),
  rule: {
    marginBlock: spacing.xxl,
    borderWidth: 0,
    borderBlockStartWidth: 1,
    borderBlockStartStyle: 'solid',
    borderBlockStartColor: colors.line,
  },
  image: { display: 'block', maxWidth: '100%', height: 'auto', marginBlock: spacing.lg, borderRadius: radii.sm },
  emphasis: { fontStyle: 'italic' },
  strong: { fontWeight: typography.strongWeight },
});

/** The class names remark-math puts on the `code` element of inline and display math. */
const MATH_INLINE = 'math-inline';
const MATH_DISPLAY = 'math-display';
const LANGUAGE_PREFIX = 'language-';

/** A paragraph of the essay. */
export function EssayParagraph(props: ComponentProps<'p'>): ReactNode {
  return <p {...mergeProps(stylex.props(styles.paragraph), props)} />;
}

/** A Markdown `#` or `##` heading, drawn as the heading of a section inside a beat, whose own title is the `h2`. */
export function EssaySection({ children, ...props }: ComponentProps<'h3'>): ReactNode {
  return <h3 {...mergeProps(stylex.props(styles.section), props)}>{children}</h3>;
}

/** A Markdown `###` heading, drawn below a section heading. */
export function EssaySubsection({ children, ...props }: ComponentProps<'h4'>): ReactNode {
  return <h4 {...mergeProps(stylex.props(styles.subsection), props)}>{children}</h4>;
}

/** A bulleted list. */
export function EssayList(props: ComponentProps<'ul'>): ReactNode {
  return <ul {...mergeProps(stylex.props(styles.list), props)} />;
}

/** A numbered list. */
export function EssayOrderedList(props: ComponentProps<'ol'>): ReactNode {
  return <ol {...mergeProps(stylex.props(styles.list), props)} />;
}

/** One item of a list. */
export function EssayItem(props: ComponentProps<'li'>): ReactNode {
  return <li {...mergeProps(stylex.props(styles.item), props)} />;
}

/** A quotation. */
export function EssayQuote(props: ComponentProps<'blockquote'>): ReactNode {
  return <blockquote {...mergeProps(stylex.props(styles.quote), props)} />;
}

/** Emphasized text. */
export function EssayEmphasis(props: ComponentProps<'em'>): ReactNode {
  return <em {...mergeProps(stylex.props(styles.emphasis), props)} />;
}

/** Strong text. */
export function EssayStrong(props: ComponentProps<'strong'>): ReactNode {
  return <strong {...mergeProps(stylex.props(styles.strong), props)} />;
}

/** A divider between two parts of a beat. */
export function EssayRule(props: ComponentProps<'hr'>): ReactNode {
  return <hr {...mergeProps(stylex.props(styles.rule), props)} />;
}

/** An image that never outgrows the text column. */
export function EssayImage({ alt, ...props }: ComponentProps<'img'>): ReactNode {
  return <img alt={alt} {...mergeProps(stylex.props(styles.image), props)} />;
}

/** A link. It follows the same rules as `ContentLink`: only web and mail addresses are followed. */
export function EssayLink({ href, title, children }: ComponentProps<'a'>): ReactNode {
  return (
    <ContentLink href={href} title={title}>
      {children}
    </ContentLink>
  );
}

/** A table that scrolls inside its own box when the column is narrower than it. */
export function EssayTable(props: ComponentProps<'table'>): ReactNode {
  return (
    <div {...stylex.props(styles.scroller)}>
      <table {...mergeProps(stylex.props(styles.table), props)} />
    </div>
  );
}

/** A table head cell. Its `align` attribute from a Markdown table column is kept. */
export function EssayHeadCell(props: ComponentProps<'th'>): ReactNode {
  return (
    <th
      {...mergeProps(stylex.props(styles.headCell, props.align !== undefined && styles.aligned(props.align)), props)}
    />
  );
}

/** A table cell. Its `align` attribute is kept. */
export function EssayCell(props: ComponentProps<'td'>): ReactNode {
  return (
    <td {...mergeProps(stylex.props(styles.cell, props.align !== undefined && styles.aligned(props.align)), props)} />
  );
}

/** The text of a code element's children. */
function sourceText(node: ReactNode): string {
  return Children.toArray(node)
    .map((part) => (typeof part === 'string' ? part : ''))
    .join('');
}

/** Whether a class list holds the class. */
function hasClass(className: string | undefined, name: string): boolean {
  return (className ?? '').split(' ').includes(name);
}

/**
 * Inline code, or inline math when remark-math marked it. Math reaches `TeX` with its TeX source, so the article's
 * typesetter draws it.
 */
export function EssayCode({ className, children, ...props }: ComponentProps<'code'>): ReactNode {
  if (hasClass(className, MATH_INLINE)) {
    return <TeX>{sourceText(children)}</TeX>;
  }

  if (hasClass(className, MATH_DISPLAY)) {
    return <TeX isDisplay>{sourceText(children)}</TeX>;
  }

  return <code {...mergeProps(stylex.props(styles.inlineCode), { ...props, className })}>{children}</code>;
}

/**
 * A fenced code block, drawn by `CodeBlock` with the language of the fence. Display math is a code element that
 * remark-math marked, so it passes through to be typeset.
 */
export function EssayPre({ children }: ComponentProps<'pre'>): ReactNode {
  const only = Children.toArray(children)[0];

  if (!isValidElement<ComponentProps<'code'>>(only)) {
    return children;
  }

  const { className, children: source } = only.props;

  if (hasClass(className, MATH_DISPLAY)) {
    return only;
  }

  const language = (className ?? '').split(' ').find((name) => name.startsWith(LANGUAGE_PREFIX));

  return (
    <div {...stylex.props(styles.codeBlock)}>
      <CodeBlock code={sourceText(source).replace(/\n$/, '')} language={language?.slice(LANGUAGE_PREFIX.length)} />
    </div>
  );
}

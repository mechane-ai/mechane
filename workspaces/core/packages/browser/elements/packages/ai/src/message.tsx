import * as stylex from '@stylexjs/stylex';
import { File } from 'lucide-react';
import type { ReactNode } from 'react';
import { ContentLink } from '../../content/src/link.ts';
import { colors, conditions, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  header: { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', minWidth: 0 },
  avatar: { display: 'inline-flex', flexShrink: 0 },
  author: { fontWeight: 500, overflowWrap: 'anywhere' },
  meta: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  content: { minWidth: 0, overflowWrap: 'anywhere' },
  user: { paddingBlock: spacing.md, paddingInline: spacing.lg, borderRadius: radii.sm, backgroundColor: colors.canvas },
  assistant: {},
  system: { color: colors.muted, paddingBlock: spacing.sm },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    opacity: {
      default: 1,
      [conditions.hoverPointer]: {
        default: 0,
        [stylex.when.ancestor(':hover')]: 1,
        [stylex.when.ancestor(':focus-within')]: 1,
      },
    },
  },
  attachments: { display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: spacing.sm },
  attachment: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
    maxWidth: '100%',
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  attachmentText: { display: 'flex', flexDirection: 'column', gap: spacing.xxs, minWidth: 0, overflowWrap: 'anywhere' },
  icon: { color: colors.muted, flexShrink: 0 },
});

export type MessageKind = 'user' | 'assistant' | 'system';

export type MessageProps = {
  readonly author: string;
  readonly children: ReactNode;
  readonly id?: string;
  readonly kind?: MessageKind;
  readonly meta?: ReactNode;
  readonly avatar?: ReactNode;
  readonly actions?: ReactNode;
  readonly attachments?: ReactNode;
};

export type MessageAttachmentProps = {
  readonly name: string;
  readonly description?: string;
  readonly href?: string;
  readonly actions?: ReactNode;
};

const kinds = { user: styles.user, assistant: styles.assistant, system: styles.system } satisfies Record<
  MessageKind,
  stylex.StyleXStyles
>;

export function Message({
  author,
  children,
  id,
  kind = 'assistant',
  meta,
  avatar,
  actions,
  attachments,
}: MessageProps): ReactNode {
  return (
    <article id={id} aria-label={author} {...stylex.props(styles.root, kinds[kind], stylex.defaultMarker())}>
      <header {...stylex.props(styles.header)}>
        {avatar !== undefined && <span {...stylex.props(styles.avatar)}>{avatar}</span>}
        <span {...stylex.props(styles.author)}>{author}</span>
        {meta !== undefined && <div {...stylex.props(styles.meta)}>{meta}</div>}
      </header>
      <div {...stylex.props(styles.content)}>{children}</div>
      {attachments !== undefined && <div {...stylex.props(styles.attachments)}>{attachments}</div>}
      {actions !== undefined && <footer {...stylex.props(styles.actions)}>{actions}</footer>}
    </article>
  );
}

export function MessageAttachment({ name, description, href, actions }: MessageAttachmentProps): ReactNode {
  return (
    <div {...stylex.props(styles.attachment)}>
      <File size={16} aria-hidden {...stylex.props(styles.icon)} />
      <div {...stylex.props(styles.attachmentText)}>
        {href === undefined ? <span>{name}</span> : <ContentLink href={href}>{name}</ContentLink>}
        {description !== undefined && <span {...stylex.props(styles.meta)}>{description}</span>}
      </div>
      {actions}
    </div>
  );
}

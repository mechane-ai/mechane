import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import { ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { colors, radii, spacing, typography } from './tokens.stylex.ts';

const styles = stylex.create({
  root: {
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    color: colors.muted,
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    listStyleType: 'none',
    padding: 0,
    margin: 0,
  },
  item: { display: 'inline-flex', alignItems: 'center', gap: spacing.sm, minWidth: 0, overflowWrap: 'anywhere' },
  current: { color: colors.ink },
  separator: { display: 'inline-flex', alignItems: 'center', color: colors.faint },
  key: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    paddingInline: spacing.xs,
    paddingBlock: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    color: colors.muted,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    whiteSpace: 'nowrap',
  },
});

type BreadcrumbRootProps = Omit<ComponentProps<'nav'>, 'aria-label'> & { readonly 'aria-label': string };
type BreadcrumbListProps = ComponentProps<'ol'>;
type BreadcrumbItemProps = ComponentProps<'li'>;
type BreadcrumbCurrentProps = ComponentProps<'span'>;
type KbdProps = Omit<ComponentProps<'kbd'>, 'children'> & { readonly children: string };

function BreadcrumbRoot(props: BreadcrumbRootProps): ReactNode {
  return <nav {...mergeProps(stylex.props(styles.root), props)} />;
}

function BreadcrumbList(props: BreadcrumbListProps): ReactNode {
  return <ol {...mergeProps(stylex.props(styles.list), props)} />;
}

function BreadcrumbItem(props: BreadcrumbItemProps): ReactNode {
  return <li {...mergeProps(stylex.props(styles.item), props)} />;
}

function BreadcrumbCurrent(props: BreadcrumbCurrentProps): ReactNode {
  return <span {...mergeProps(stylex.props(styles.current), props)} aria-current="page" />;
}

function BreadcrumbSeparator(): ReactNode {
  return (
    <li role="presentation" aria-hidden {...stylex.props(styles.separator)}>
      <ChevronRight size={12} />
    </li>
  );
}

export function Kbd(props: KbdProps): ReactNode {
  return <kbd {...mergeProps(stylex.props(styles.key), props)} />;
}

export const Breadcrumb = {
  Root: BreadcrumbRoot,
  List: BreadcrumbList,
  Item: BreadcrumbItem,
  Current: BreadcrumbCurrent,
  Separator: BreadcrumbSeparator,
};

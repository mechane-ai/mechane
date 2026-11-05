import * as stylex from '@stylexjs/stylex';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { Heading, Muted } from '../../core/src/index.ts';
import {
  colors,
  conditions,
  controls,
  pageGeometry,
  spacing,
  typography,
} from '../../foundations/src/tokens.stylex.ts';
import { DetailPage } from './detail-page.tsx';
import { frame } from './frame.stylex.ts';
import { PageToolbar } from './page-toolbar.tsx';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    WebkitFontSmoothing: 'antialiased',
  },
  back: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.sm,
    'minHeight': controls.coarseTarget,
    'minWidth': 0,
    'maxWidth': '100%',
    'color': colors.ink,
    'textDecorationLine': 'none',
    ':hover': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  backIcon: { flexShrink: 0 },
  backLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  body: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: pageGeometry.sectionGap, minWidth: 0 },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexBasis: frame.recordContentWidth,
    flexGrow: 1,
    gap: pageGeometry.sectionGap,
    minWidth: 0,
  },
  header: { display: 'grid', gap: spacing.md, minWidth: 0 },
  identity: { display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  title: { minWidth: 0, outlineStyle: 'none' },
  icon: { display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  aside: {
    display: 'flex',
    flexDirection: 'column',
    flexBasis: frame.recordAsideWidth,
    flexGrow: 1,
    gap: spacing.xl,
    minWidth: 0,
  },
});

export type RecordPageRootProps = { readonly children: ReactNode };
export type RecordPageBodyProps = { readonly children: ReactNode };
export type RecordPageContentProps = { readonly children: ReactNode };

export type RecordPageToolbarProps = {
  readonly backLabel: string;
  readonly backHref: string;
  readonly onBack?: () => void;
  readonly actions?: ReactNode;
  readonly navigation?: boolean;
};

export type RecordPageHeaderProps = {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  readonly titleRef?: Ref<HTMLHeadingElement>;
};

export type RecordPageAsideProps = { readonly children: ReactNode; readonly label?: string };

function RecordPageRoot({ children }: RecordPageRootProps): ReactNode {
  return <div {...stylex.props(styles.root)}>{children}</div>;
}

function RecordPageToolbar({
  backLabel,
  backHref,
  onBack,
  actions,
  navigation = true,
}: RecordPageToolbarProps): ReactNode {
  return (
    <PageToolbar
      breadcrumb
      navigation={navigation}
      actions={actions}
      title={
        <a
          href={backHref}
          {...stylex.props(styles.back)}
          onClick={(event) => {
            if (onBack === undefined || event.defaultPrevented || event.button !== 0) {
              return;
            }

            const command = event.metaKey || event.ctrlKey;
            const alternate = event.shiftKey || event.altKey;

            if (command || alternate) {
              return;
            }

            event.preventDefault();
            onBack();
          }}
        >
          <ArrowLeft size={16} aria-hidden {...stylex.props(styles.backIcon)} />
          <span {...stylex.props(styles.backLabel)}>{backLabel}</span>
        </a>
      }
    />
  );
}

function RecordPageBody({ children }: RecordPageBodyProps): ReactNode {
  return (
    <DetailPage>
      <div {...stylex.props(styles.body)}>{children}</div>
    </DetailPage>
  );
}

function RecordPageContent({ children }: RecordPageContentProps): ReactNode {
  return <div {...stylex.props(styles.content)}>{children}</div>;
}

function RecordPageHeader({ title, description, icon, titleRef }: RecordPageHeaderProps): ReactNode {
  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.identity)}>
        {icon !== undefined && icon !== null && (
          <span aria-hidden {...stylex.props(styles.icon)}>
            {icon}
          </span>
        )}
        <Heading ref={titleRef} tabIndex={-1} {...stylex.props(styles.title)}>
          {title}
        </Heading>
      </div>
      {description !== undefined && description !== null && <Muted>{description}</Muted>}
    </header>
  );
}

function RecordPageAside({ children, label = 'Properties' }: RecordPageAsideProps): ReactNode {
  return (
    <aside aria-label={label} {...stylex.props(styles.aside)}>
      {children}
    </aside>
  );
}

export const RecordPage = {
  Root: RecordPageRoot,
  Toolbar: RecordPageToolbar,
  Body: RecordPageBody,
  Content: RecordPageContent,
  Header: RecordPageHeader,
  Aside: RecordPageAside,
};

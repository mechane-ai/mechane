import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import { SectionHeading } from '../../core/src/index.ts';
import type { SectionHeadingProps } from '../../core/src/index.ts';
import { layers } from '../../foundations/src/constants.stylex.ts';
import { pageGeometry } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { PageNavigation, PageNavigationPlaceholder } from '../../navigation/src/index.ts';
import type { PageNavigationPlaceholderProps, PageNavigationProps } from '../../navigation/src/index.ts';
import { PageContent } from './page-content.tsx';
import { PageToolbar } from './page-toolbar.tsx';
import type { PageToolbarProps } from './page-toolbar.tsx';

type Navigation<Item extends string> =
  | PageNavigationProps<Item>
  | (PageNavigationPlaceholderProps & { readonly isPlaceholder: true });

type PageLayoutProps<Item extends string> = PageToolbarProps & {
  readonly ref?: Ref<HTMLDivElement>;
  readonly navigation?: Navigation<Item> | undefined;
  readonly children: ReactNode;
  readonly scrollRestorationId?: string;
};

const styles = stylex.create({
  page: {
    height: '100dvh',
    maxHeight: '100%',
    minWidth: 0,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
  },
  header: { minWidth: 0 },
  body: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    containerType: 'size',
    containerName: 'page-body',
    scrollPaddingBlockStart: pageGeometry.toolbarHeight,
  },
  section: { minWidth: 0, flexShrink: 0, isolation: 'isolate' },
  sectionContent: { isolation: 'isolate' },
  sectionHeader: {
    position: { 'default': 'static', '@container page-body (min-height: 260px)': 'sticky' },
    insetBlockStart: 0,
    zIndex: layers.sticky,
  },
});

export function PageLayout<Item extends string>({
  ref,
  navigation,
  children,
  scrollRestorationId = 'page-body',
  ...toolbar
}: PageLayoutProps<Item>): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();

  return (
    <div ref={ref} {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <PageToolbar {...toolbar} />
        {navigation !== undefined &&
          ('isPlaceholder' in navigation ? (
            <PageNavigationPlaceholder {...navigation} />
          ) : (
            <PageNavigation {...navigation} />
          ))}
      </div>
      <div
        ref={scroll.ref}
        tabIndex={scroll.tabIndex}
        data-scroll-restoration-id={scrollRestorationId}
        {...stylex.props(styles.body)}
      >
        {children}
      </div>
    </div>
  );
}

type PageSectionProps = SectionHeadingProps &
  (
    | { readonly children: ReactNode; readonly summary?: never; readonly breakdown?: never }
    | { readonly summary: ReactNode; readonly breakdown?: ReactNode; readonly children?: never }
    | { readonly breakdown: ReactNode; readonly summary?: ReactNode; readonly children?: never }
  );

export function PageSection({ children, summary, breakdown, ...heading }: PageSectionProps): ReactNode {
  const hasSummary = summary !== null && summary !== undefined && summary !== false;
  const generatedId = useId();
  const id = heading.id ?? generatedId;

  return (
    <section aria-labelledby={id} {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading {...heading} id={id} />
      </div>
      <div {...stylex.props(styles.sectionContent)}>
        {hasSummary && <PageContent>{summary}</PageContent>}
        {breakdown}
        {children}
      </div>
    </section>
  );
}

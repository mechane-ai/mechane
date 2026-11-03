import { Brand, DetailPage, EmptyState, Layout, Loading, TextLink, Toolbar } from '@mechane/ui';
import type { ReactNode } from 'react';

export function ConsoleEntrance({ children }: { readonly children?: ReactNode }): ReactNode {
  return (
    <Layout sidebar={<Brand />}>
      <Toolbar title="Mechane Console" navigation={false} />
      <DetailPage>{children ?? <Loading shape="detail" label="Opening console" />}</DetailPage>
    </Layout>
  );
}

export function Welcome(): ReactNode {
  return (
    <ConsoleEntrance>
      <EmptyState title="Welcome to Mechane" action={<TextLink href="/auth/sign-in">Sign in →</TextLink>}>
        Sign in to open your workspace and follow your mechs.
      </EmptyState>
    </ConsoleEntrance>
  );
}

import { ConsoleBrand } from '@mechane/console-views';
import { EmptyState, Loading, TextLink } from '@mechane/ui';
import { AppShell, DetailPage, PageToolbar } from '@mechane/ui-layout';
import type { ReactNode } from 'react';

export function ConsoleEntrance({ children }: { readonly children?: ReactNode }): ReactNode {
  return (
    <AppShell sidebar={<ConsoleBrand />}>
      <PageToolbar title="Mechane Console" navigation={false} />
      <DetailPage>{children ?? <Loading shape="detail" label="Opening console" />}</DetailPage>
    </AppShell>
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

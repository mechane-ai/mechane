import { Button, Heading, Muted, Stack } from '@mechane-ai/elements';
import { AsyncRegion } from '@mechane-ai/elements/feedback';
import { FocusPage } from '@mechane-ai/elements/layout';
import { signInPath } from '@mechane/protocol';
import type { ReactNode } from 'react';

export function ConsoleEntrance({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <FocusPage>
      <strong>mechane</strong>
      {children}
    </FocusPage>
  );
}

export function ConsolePending(): ReactNode {
  return (
    <FocusPage>
      <AsyncRegion state="pending" label="Opening your workspace" placeholder={<Muted>Opening workspace…</Muted>} />
    </FocusPage>
  );
}

export function Welcome({ returnTo = '/console' }: { readonly returnTo?: string }): ReactNode {
  return (
    <ConsoleEntrance>
      <Stack>
        <Stack isCompact>
          <Heading>Your agents, at work.</Heading>
          <Muted>Pick up a conversation. Follow the work. See how it happened.</Muted>
        </Stack>
        <Button variant="solid" nativeButton={false} render={<a href={signInPath({ returnTo })} />}>
          Continue with GitHub →
        </Button>
        <Muted>Sign in to your Mechane workspace.</Muted>
      </Stack>
    </ConsoleEntrance>
  );
}

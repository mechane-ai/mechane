import { Button, Muted, Stack, TextLink } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Notice } from '@mechane-ai/elements/feedback';
import { SettingsSection } from '@mechane-ai/elements/forms';
import { DetailPage, PageToolbar } from '@mechane-ai/elements/layout';
import type { ConsoleData, Session } from '@mechane/console-data';
import type { Workspace } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { useNavigationPreferences } from '../navigation-preferences.tsx';
import { DataStatus } from './data-status.tsx';

export function WorkspaceSettings({
  data,
  session,
  workspace,
}: {
  readonly data: ConsoleData;
  readonly session: Session;
  readonly workspace: Workspace;
}): ReactNode {
  const { hasPersistenceError } = useNavigationPreferences();
  const [isSigningOut, setSigningOut] = useState(false);

  function signOut(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (isSigningOut) {
      return;
    }

    const form = event.currentTarget;

    setSigningOut(true);
    void data.clearScope().then(
      () => form.submit(),
      () => form.submit(),
    );
  }

  return (
    <>
      <PageToolbar title="Settings" />
      <DetailPage>
        <Stack>
          <SettingsSection title="Workspace">
            <Details items={[{ label: 'Name', value: workspace.name }]} />
            {hasPersistenceError && <Notice hasError>This browser could not save your pins and recent mechs.</Notice>}
          </SettingsSection>
          <SettingsSection title="Account">
            <Details
              items={[
                { label: 'Signed in as', value: session.principal.name },
                {
                  label: 'Session',
                  value: (
                    <form method={HttpMethod.Post} action="/auth/sign-out" onSubmit={signOut}>
                      <Button type="submit" isPending={isSigningOut} pendingLabel="Signing out…">
                        Sign out
                      </Button>
                    </form>
                  ),
                },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="About">
            <Stack isCompact>
              <TextLink href="https://github.com/mechane-ai/mechane" target="_blank" rel="noreferrer">
                Documentation
              </TextLink>
              <TextLink href="/console/THIRD_PARTY_LICENSES.txt">Open-source notices</TextLink>
              <Muted>Mechane</Muted>
            </Stack>
          </SettingsSection>
          <DataStatus data={data} />
        </Stack>
      </DetailPage>
    </>
  );
}

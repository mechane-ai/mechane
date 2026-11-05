import { Button, Muted, Stack, TextLink } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Notice } from '@mechane-ai/elements/feedback';
import { SettingsSection } from '@mechane-ai/elements/forms';
import { DetailPage, PageToolbar } from '@mechane-ai/elements/layout';
import type { Session } from '@mechane/console-data';
import type { Workspace } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import type { ReactNode } from 'react';
import { useNavigationPreferences } from '../navigation-preferences.tsx';

export function WorkspaceSettings({
  session,
  workspace,
}: {
  readonly session: Session;
  readonly workspace: Workspace;
}): ReactNode {
  const { persistenceError } = useNavigationPreferences();

  return (
    <>
      <PageToolbar title="Settings" />
      <DetailPage>
        <Stack>
          <SettingsSection title="Workspace">
            <Details items={[{ label: 'Name', value: workspace.name }]} />
            {persistenceError && <Notice error>This browser could not save your pins and recent mechs.</Notice>}
          </SettingsSection>
          <SettingsSection title="Account">
            <Details
              items={[
                { label: 'Signed in as', value: session.principal.name },
                {
                  label: 'Session',
                  value: (
                    <form method={HttpMethod.Post} action="/auth/sign-out">
                      <Button type="submit">Sign out</Button>
                    </form>
                  ),
                },
              ]}
            />
          </SettingsSection>
          <SettingsSection title="About">
            <Stack compact>
              <TextLink href="https://github.com/mechane-ai/mechane" target="_blank" rel="noreferrer">
                Documentation
              </TextLink>
              <TextLink href="/console/THIRD_PARTY_LICENSES.txt">Open-source notices</TextLink>
              <Muted>Mechane</Muted>
            </Stack>
          </SettingsSection>
        </Stack>
      </DetailPage>
    </>
  );
}

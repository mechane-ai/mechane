import { Avatar, Muted } from '@mechane-ai/elements';
import { Select } from '@mechane-ai/elements/forms';
import { AppShell, Navigation, SidebarFooter, SidebarLabel } from '@mechane-ai/elements/layout';
import type { Workspace } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

const styles = stylex.create({ workspaceTrigger: { width: '100%' }, workspacePositioner: { minWidth: 224 } });

type WorkspaceSwitcherProps = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
};

function WorkspaceSwitcher({ workspaces, workspaceId, onWorkspace }: WorkspaceSwitcherProps): ReactNode {
  const selected = workspaces.find((workspace) => workspace.id === workspaceId);
  const personal = workspaces[0];

  const selectedLabel =
    selected === undefined ? 'Workspace' : selected.id === personal?.id ? 'Personal' : selected.name;

  const options = [...workspaces.slice(1), ...workspaces.slice(0, 1)].map((workspace) => ({
    value: workspace.id,
    label: workspace.id === personal?.id ? 'Personal' : workspace.name,
    description: workspace.id === personal?.id ? workspace.name : 'Team workspace',
  }));

  return (
    <Select.Root<string>
      value={workspaceId}
      items={options}
      onValueChange={(value) => {
        if (value !== null) {
          onWorkspace(value);
        }
      }}
    >
      <Select.Trigger
        variant="ghost"
        aria-label={`Workspace: ${selectedLabel}`}
        title={selectedLabel}
        xstyle={styles.workspaceTrigger}
      >
        <Avatar label={selectedLabel} fallback={selectedLabel.slice(0, 1).toUpperCase()} size="sm" />
        <SidebarLabel shouldGrow>
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={16} aria-hidden />
          </Select.Icon>
        </SidebarLabel>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner align="start" xstyle={styles.workspacePositioner}>
          <Select.Popup>
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Muted>{option.description}</Muted>
                  <Select.ItemIndicator>
                    <Check size={16} aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function ConsoleShell({
  workspaces,
  workspaceId,
  onWorkspace,
  homeLink,
  accountLink,
  children,
  shouldFocus = false,
}: {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
  readonly homeLink: ReactNode;
  readonly accountLink: ReactNode;
  readonly children: ReactNode;
  readonly shouldFocus?: boolean;
}): ReactNode {
  return (
    <AppShell
      sidebarHeader={<WorkspaceSwitcher workspaces={workspaces} workspaceId={workspaceId} onWorkspace={onWorkspace} />}
      sidebar={homeLink}
      shouldFocus={shouldFocus}
      footer={
        <SidebarFooter layout="navigation">
          <Navigation label="Account">{accountLink}</Navigation>
        </SidebarFooter>
      }
    >
      {children}
    </AppShell>
  );
}

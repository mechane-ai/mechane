import { Muted } from '@mechane-ai/elements';
import { Select } from '@mechane-ai/elements/forms';
import { AppShell, SidebarFooter, SidebarLabel } from '@mechane-ai/elements/layout';
import { colors, controls, radii, spacing, typography } from '@mechane-ai/elements/tokens.stylex';
import type { Workspace } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

const styles = stylex.create({
  workspaceTrigger: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBlock: 0,
    paddingInline: controls.gap,
    borderRadius: 0,
  },
  workspaceIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: controls.smHeight,
    height: controls.smHeight,
    flexShrink: 0,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: typography.captionSize,
    fontWeight: 500,
  },
  workspacePositioner: { minWidth: 224 },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    fontFamily: typography.fontFamily,
  },
});

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
        <span aria-hidden {...stylex.props(styles.workspaceIcon)}>
          {selectedLabel.slice(0, 1).toUpperCase()}
        </span>
        <SidebarLabel grow>
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
  name,
  origin,
  workspaces,
  workspaceId,
  onWorkspace,
  homeLink,
  children,
  focus = false,
}: {
  readonly name: string;
  readonly origin: string;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
  readonly homeLink: ReactNode;
  readonly children: ReactNode;
  readonly focus?: boolean;
}): ReactNode {
  return (
    <AppShell
      sidebarHeader={<WorkspaceSwitcher workspaces={workspaces} workspaceId={workspaceId} onWorkspace={onWorkspace} />}
      sidebar={homeLink}
      focus={focus}
      footer={
        <SidebarFooter>
          <span title={`Signed in as ${name} on ${origin}`} {...stylex.props(styles.brand)}>
            <UserRound size={14} aria-hidden />
            <SidebarLabel>{name}</SidebarLabel>
          </span>
        </SidebarFooter>
      }
    >
      {children}
    </AppShell>
  );
}

import type { Workspace } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Select } from '@mechane/ui';
import { AppShell, Navigation, NavigationItem, NavigationLink, SidebarFooter, SidebarLabel } from '@mechane/ui-layout';
import { colors, controls, radii, spacing, typography } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, Check, ChevronDown, FileText, Layers3, LogOut } from 'lucide-react';
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
  brandIcon: { flexShrink: 0 },
});

type WorkspaceSwitcherProps = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
};

function WorkspaceSwitcher({ workspaces, workspaceId, onWorkspace }: WorkspaceSwitcherProps): ReactNode {
  const selected = workspaces.find((workspace) => workspace.id === workspaceId);
  const selectedLabel = selected === undefined ? 'Workspace' : selected.name;
  const options = workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }));

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

export function ConsoleBrand(): ReactNode {
  return (
    <span {...stylex.props(styles.brand)}>
      <Layers3 size={16} aria-hidden {...stylex.props(styles.brandIcon)} />
      <SidebarLabel>mechane</SidebarLabel>
    </span>
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
}: {
  readonly name: string;
  readonly origin: string;
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceId: string;
  readonly onWorkspace: (id: string) => void;
  readonly homeLink: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <AppShell
      sidebarHeader={<WorkspaceSwitcher workspaces={workspaces} workspaceId={workspaceId} onWorkspace={onWorkspace} />}
      sidebar={<Navigation label="Console">{homeLink}</Navigation>}
      footer={
        <>
          <Navigation label="Help and account">
            <NavigationLink
              href="https://github.com/mechane-ai/mechane"
              icon={<BookOpen size={14} strokeWidth={1.75} aria-hidden />}
              target="_blank"
              rel="noreferrer"
            >
              Documentation
            </NavigationLink>
            <NavigationLink
              href="/console/THIRD_PARTY_LICENSES.txt"
              icon={<FileText size={14} strokeWidth={1.75} aria-hidden />}
            >
              Open-source licenses
            </NavigationLink>
            <form method={HttpMethod.Post} action="/auth/sign-out">
              <NavigationItem
                type="submit"
                icon={<LogOut size={14} strokeWidth={1.75} aria-hidden />}
                title={`Signed in as ${name} on ${origin}`}
              >
                Sign out
              </NavigationItem>
            </form>
          </Navigation>
          <SidebarFooter>
            <ConsoleBrand />
          </SidebarFooter>
        </>
      }
    >
      {children}
    </AppShell>
  );
}

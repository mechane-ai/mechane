import { AgentAvatar, IconButton } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import { Select } from '@mechane-ai/elements/forms';
import { PageToolbar } from '@mechane-ai/elements/layout';
import { Menu, Tooltip } from '@mechane-ai/elements/overlays';
import { colors, spacing, typography } from '@mechane-ai/elements/tokens.stylex';
import type { ConsoleView, Mech } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import { Check, ChevronDown, MoreHorizontal, Pause, Pin, PinOff, Play, Settings } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

const sections: ReadonlyArray<{ readonly value: ConsoleView; readonly label: string }> = [
  { value: 'conversation', label: 'Conversation' },
  { value: 'work', label: 'Work' },
  { value: 'runs', label: 'Runs' },
  { value: 'memory', label: 'Memory' },
  { value: 'activity', label: 'History' },
  { value: 'definition', label: 'Settings' },
];

const styles = stylex.create({
  identity: { display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  name: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, minWidth: 0 },
  state: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.captionSize,
    display: { 'default': 'inline', '@container toolbar (max-width:600px)': 'none' },
  },
  trigger: { gap: spacing.xs, minWidth: 0 },
  menu: { minWidth: 180 },
  desktopActions: {
    display: { 'default': 'flex', '@container toolbar (max-width:600px)': 'none' },
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactActions: { display: { 'default': 'none', '@container toolbar (max-width:600px)': 'flex' } },
});

function HeaderAction({
  label,
  ...props
}: Omit<ComponentProps<typeof IconButton>, 'aria-label'> & { readonly label: string }): ReactNode {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<IconButton {...props} variant="ghost" size="sm" aria-label={label} />} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom">
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function MechHeader({
  mech,
  appearance,
  view,
  pinned,
  busy,
  onView,
  onPin,
  onStatus,
  onSettings,
}: {
  readonly mech: Pick<Mech, 'id' | 'name' | 'status'>;
  readonly appearance?: AgentAppearance | undefined;
  readonly view: ConsoleView;
  readonly pinned: boolean;
  readonly busy: boolean;
  readonly onView: (view: ConsoleView) => void;
  readonly onPin: () => void;
  readonly onStatus: () => void;
  readonly onSettings: () => void;
}): ReactNode {
  const pinLabel = pinned ? 'Unpin mech' : 'Pin mech';
  const statusLabel = mech.status === 'active' ? 'Pause mech' : 'Resume mech';
  const pendingLabel = mech.status === 'active' ? 'Pausing mech…' : 'Resuming mech…';

  return (
    <PageToolbar
      title={
        <span {...stylex.props(styles.identity)}>
          <AgentAvatar seed={mech.id} appearance={appearance} size="sm" />
          <span {...stylex.props(styles.name)}>{mech.name}</span>
          {mech.status !== 'active' && (
            <span {...stylex.props(styles.state)}>{mech.status === 'paused' ? 'Paused' : 'Archived'}</span>
          )}
        </span>
      }
      views={
        <Select.Root<ConsoleView>
          value={view}
          items={sections}
          onValueChange={(value) => {
            if (value !== null) {
              onView(value);
            }
          }}
        >
          <Select.Trigger variant="ghost" aria-label="Mech view" xstyle={styles.trigger}>
            <Select.Value />
            <Select.Icon>
              <ChevronDown size={14} aria-hidden />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner align="start" xstyle={styles.menu}>
              <Select.Popup>
                <Select.List>
                  {sections.map((section) => (
                    <Select.Item key={section.value} value={section.value}>
                      <Select.ItemText>{section.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={14} aria-hidden />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      }
      actions={
        <>
          <div {...stylex.props(styles.desktopActions)}>
            <HeaderAction label={pinLabel} aria-pressed={pinned} onClick={onPin}>
              {pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
            </HeaderAction>
            {mech.status !== 'archived' && (
              <HeaderAction label={busy ? pendingLabel : statusLabel} pending={busy} onClick={onStatus}>
                {mech.status === 'active' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              </HeaderAction>
            )}
            <HeaderAction label="Mech settings" onClick={onSettings}>
              <Settings size={16} aria-hidden />
            </HeaderAction>
          </div>
          <div {...stylex.props(styles.compactActions)}>
            <Menu.Root>
              <Menu.Trigger render={<IconButton variant="ghost" size="sm" aria-label="Mech actions" />}>
                <MoreHorizontal size={16} aria-hidden />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner align="end">
                  <Menu.Popup>
                    <Menu.Item onClick={onPin}>
                      {pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />}
                      {pinLabel}
                    </Menu.Item>
                    {mech.status !== 'archived' && (
                      <Menu.Item onClick={onStatus} disabled={busy} aria-busy={busy}>
                        {mech.status === 'active' ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
                        {busy ? pendingLabel : statusLabel}
                      </Menu.Item>
                    )}
                    <Menu.Item onClick={onSettings}>
                      <Settings size={16} aria-hidden />
                      Settings
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </>
      }
    />
  );
}

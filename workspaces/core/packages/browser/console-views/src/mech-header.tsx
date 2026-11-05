import { AgentAvatar, IconButton } from '@mechane-ai/elements';
import type { AgentAppearance } from '@mechane-ai/elements';
import { Select } from '@mechane-ai/elements/forms';
import { PageToolbar } from '@mechane-ai/elements/layout';
import { PageNavigation } from '@mechane-ai/elements/navigation';
import { Menu } from '@mechane-ai/elements/overlays';
import { colors, conditions, spacing, typography } from '@mechane-ai/elements/tokens.stylex';
import type { ConsoleView, Mech } from '@mechane/protocol';
import * as stylex from '@stylexjs/stylex';
import {
  Check,
  ChevronDown,
  History,
  MemoryStick,
  MoreHorizontal,
  Pause,
  Pin,
  PinOff,
  Play,
  Settings,
} from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { MechPinButton } from './mech-pin.tsx';

const sections: ReadonlyArray<{ readonly value: ConsoleView; readonly label: string }> = [
  { value: 'conversation', label: 'Conversation' },
  { value: 'work', label: 'Work' },
  { value: 'runs', label: 'Runs' },
  { value: 'memory', label: 'Memory' },
  { value: 'activity', label: 'History' },
  { value: 'definition', label: 'Settings' },
];

const primaryViews: ReadonlySet<ConsoleView> = new Set(['conversation', 'work', 'runs']);
const secondaryViews: ReadonlySet<ConsoleView> = new Set(['memory', 'activity', 'definition']);

const styles = stylex.create({
  identity: { display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: typography.mediumWeight,
    minWidth: 0,
  },
  state: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.captionSize,
    display: { 'default': 'inline', '@container toolbar (max-width:600px)': 'none' },
  },
  trigger: { minWidth: 0 },
  menu: { minWidth: 180 },
  wide: { display: { 'default': 'flex', '@container toolbar (max-width:600px)': 'none' }, alignItems: 'center' },
  narrow: { display: { 'default': 'none', '@container toolbar (max-width:600px)': 'flex' } },
  pin: {
    display: { 'default': 'flex', '@container toolbar (max-width:600px)': 'none' },
    opacity: {
      default: 1,
      [conditions.hoverPointer]: {
        default: 0,
        [stylex.when.ancestor(':hover')]: 1,
        [stylex.when.ancestor(':focus-within')]: 1,
      },
    },
  },
  pinned: { opacity: 1 },
  secondaryName: { color: colors.ink, fontSize: typography.bodySize, paddingInlineEnd: spacing.xs },
  menuTrigger: { display: 'flex', alignItems: 'center', gap: spacing.xs },
});

export function MechHeader({
  mech,
  appearance,
  view,
  pinned,
  busy,
  viewHref,
  onView,
  onPin,
  onStatus,
}: {
  readonly mech: Pick<Mech, 'id' | 'name' | 'status'>;
  readonly appearance?: AgentAppearance | undefined;
  readonly view: ConsoleView;
  readonly pinned: boolean;
  readonly busy: boolean;
  readonly viewHref: (view: ConsoleView) => string;
  readonly onView: (view: ConsoleView) => void;
  readonly onPin: () => void;
  readonly onStatus: () => void;
}): ReactNode {
  const pinLabel = pinned ? 'Unpin mech' : 'Pin mech';
  const statusLabel = mech.status === 'active' ? 'Pause mech' : 'Resume mech';
  const pendingLabel = mech.status === 'active' ? 'Pausing mech…' : 'Resuming mech…';
  const currentSection = sections.find((section) => section.value === view);
  const secondaryName = secondaryViews.has(view) ? currentSection?.label : undefined;

  const stateLabel = busy
    ? 'Updating…'
    : mech.status === 'paused'
      ? 'Paused'
      : mech.status === 'archived'
        ? 'Archived'
        : undefined;

  function selectView(event: MouseEvent, next: ConsoleView): void {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    const command = event.metaKey || event.ctrlKey;
    const alternate = event.shiftKey || event.altKey;

    if (command || alternate) {
      return;
    }

    event.preventDefault();
    onView(next);
  }

  return (
    <PageToolbar
      title={
        <span {...stylex.props(styles.identity, stylex.defaultMarker())}>
          <AgentAvatar seed={mech.id} appearance={appearance} size="sm" />
          <span {...stylex.props(styles.name)}>{mech.name}</span>
          {stateLabel !== undefined && <span {...stylex.props(styles.state)}>{stateLabel}</span>}
          <span {...stylex.props(styles.pin, pinned && styles.pinned)}>
            <MechPinButton name={mech.name} pinned={pinned} onToggle={onPin} />
          </span>
        </span>
      }
      views={
        <>
          <div {...stylex.props(styles.wide)}>
            <PageNavigation
              label="Mech views"
              embedded
              items={sections
                .filter((section) => primaryViews.has(section.value))
                .map((section) => ({ id: section.value, label: section.label, href: viewHref(section.value) }))}
              selectedId={view}
              onNavigate={onView}
            />
          </div>
          <div {...stylex.props(styles.narrow)}>
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
          </div>
        </>
      }
      actions={
        <Menu.Root>
          <div {...stylex.props(styles.menuTrigger)}>
            {secondaryName !== undefined && (
              <span {...stylex.props(styles.wide, styles.secondaryName)}>{secondaryName}</span>
            )}
            <Menu.Trigger render={<IconButton variant="ghost" aria-label="More mech options" aria-busy={busy} />}>
              <MoreHorizontal size={16} aria-hidden />
            </Menu.Trigger>
          </div>
          <Menu.Portal>
            <Menu.Positioner align="end">
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel>Views</Menu.GroupLabel>
                  <Menu.LinkItem
                    closeOnClick
                    href={viewHref('memory')}
                    aria-current={view === 'memory' ? 'page' : undefined}
                    onClick={(event) => selectView(event, 'memory')}
                  >
                    <MemoryStick size={16} aria-hidden />
                    Memory
                  </Menu.LinkItem>
                  <Menu.LinkItem
                    closeOnClick
                    href={viewHref('activity')}
                    aria-current={view === 'activity' ? 'page' : undefined}
                    onClick={(event) => selectView(event, 'activity')}
                  >
                    <History size={16} aria-hidden />
                    History
                  </Menu.LinkItem>
                  <Menu.LinkItem
                    closeOnClick
                    href={viewHref('definition')}
                    aria-current={view === 'definition' ? 'page' : undefined}
                    onClick={(event) => selectView(event, 'definition')}
                  >
                    <Settings size={16} aria-hidden />
                    Settings
                  </Menu.LinkItem>
                </Menu.Group>
                <Menu.Separator />
                <Menu.Group>
                  <Menu.GroupLabel>Mech</Menu.GroupLabel>
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
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      }
    />
  );
}

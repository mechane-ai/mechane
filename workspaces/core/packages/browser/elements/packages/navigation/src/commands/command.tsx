import * as stylex from '@stylexjs/stylex';
import { matchesShortcut } from '@ui-sdk/core/shortcuts';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@ui-sdk/react/command';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import { useEffect, useEffectEvent } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { controlStyles } from '../../../foundations/src/control-styles.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { Dialog } from '../../../overlays/src/index.ts';
import { Kbd } from '../navigation.tsx';

const styles = stylex.create({
  content: { display: 'flex', flexDirection: 'column', gap: spacing.md },
  list: { padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'contain' },
  item: {
    'display': 'flex',
    'boxSizing': 'border-box',
    'alignItems': 'center',
    'gap': spacing.lg,
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingBlock': spacing.sm,
    'paddingInline': spacing.sm,
    'borderRadius': radii.sm,
    'color': colors.ink,
    'backgroundColor': colors.surface,
    'fontFamily': typography.fontFamily,
    'fontWeight': typography.regularWeight,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'cursor': 'pointer',
    ':is([data-highlighted])': { backgroundColor: colors.canvas },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
    ':is([data-disabled])': { color: colors.muted, opacity: controls.disabledOpacity, cursor: 'default' },
  },
  text: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  description: {
    display: 'block',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  empty: {
    'padding': spacing.lg,
    'color': colors.muted,
    'fontSize': typography.bodySize,
    ':empty': { display: 'none' },
  },
});

export type CommandShortcut = {
  readonly key: string;
  readonly mod?: boolean;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
};

export type CommandAction = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly shortcut?: CommandShortcut;
  readonly isDisabled?: boolean;
  readonly shouldRun?: (event: KeyboardEvent) => boolean;
  readonly onSelect: () => void;
};

export type CommandShortcutsOptions = {
  readonly commands: ReadonlyArray<CommandAction>;
  readonly target: RefObject<HTMLElement | null> | HTMLElement | null;
  readonly isEnabled: boolean;
};

function shortcutKeys(shortcut: CommandShortcut): string {
  return [
    shortcut.mod === true && 'mod',
    shortcut.ctrl === true && 'ctrl',
    shortcut.meta === true && 'meta',
    shortcut.shift === true && 'shift',
    shortcut.alt === true && 'alt',
    shortcut.key,
  ]
    .filter(Boolean)
    .join('+');
}

export function useCommandShortcuts({ commands, target, isEnabled }: CommandShortcutsOptions): void {
  const handleKey = useEffectEvent((event: KeyboardEvent, region: HTMLElement) => {
    if (event.defaultPrevented || event.repeat || event.isComposing) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null
    ) {
      return;
    }

    const command = commands.find((action) => {
      if (action.isDisabled === true || action.shortcut === undefined) {
        return false;
      }

      return matchesShortcut(event, shortcutKeys(action.shortcut)) && action.shouldRun?.(event) !== false;
    });

    if (command === undefined) {
      return;
    }

    const overlays = region.ownerDocument.querySelectorAll(
      ':is(dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot="popover-content"]):not([data-closed])',
    );

    for (const overlay of overlays) {
      if (overlay.getClientRects().length > 0 && !overlay.contains(region)) {
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();
    command.onSelect();
  });

  useEffect(() => {
    const region = target !== null && 'current' in target ? target.current : target;

    if (!isEnabled || region === null) {
      return;
    }

    const scope = region;

    function onKeyDown(event: KeyboardEvent): void {
      handleKey(event, scope);
    }

    region.addEventListener('keydown', onKeyDown);

    return () => region.removeEventListener('keydown', onKeyDown);
  }, [isEnabled, target]);
}

export type ShortcutHintProps = { readonly shortcut: CommandShortcut };

export function ShortcutHint({ shortcut }: ShortcutHintProps): ReactNode {
  const { text } = useShortcutHint(shortcutKeys(shortcut));

  return <Kbd>{text}</Kbd>;
}

export type CommandPaletteProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly commands: ReadonlyArray<CommandAction>;
  readonly trigger?: ReactElement;
  readonly placeholder?: string;
  readonly empty?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  title,
  commands,
  trigger,
  placeholder = 'Search commands…',
  empty = 'No matching commands',
}: CommandPaletteProps): ReactNode {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger !== undefined && <Dialog.Trigger render={trigger} />}
      <Dialog.Backdrop motion="none" />
      <Dialog.Popup motion="none">
        <div {...stylex.props(styles.content)}>
          <Dialog.Title>{title}</Dialog.Title>
          <Command
            filter="contains"
            onAction={(id) => {
              const command = commands.find((action) => action.id === id && action.isDisabled !== true);

              if (command !== undefined) {
                onOpenChange(false);
                command.onSelect();
              }
            }}
            {...stylex.props(styles.content)}
          >
            <CommandInput
              aria-label={placeholder}
              placeholder={placeholder}
              {...stylex.props(
                controlStyles.base,
                controlStyles.field,
                controlStyles.singleLineField,
                controlStyles.textFieldState,
              )}
            />
            <CommandList {...stylex.props(styles.list)}>
              {commands.map((command) => (
                <CommandItem
                  key={command.id}
                  value={command.id}
                  label={command.label}
                  disabled={command.isDisabled === true}
                  {...stylex.props(styles.item)}
                >
                  <span {...stylex.props(styles.text)}>
                    {command.label}
                    {command.description !== undefined && (
                      <span {...stylex.props(styles.description)}>{command.description}</span>
                    )}
                  </span>
                  {command.shortcut !== undefined && <ShortcutHint shortcut={command.shortcut} />}
                </CommandItem>
              ))}
            </CommandList>
            <CommandEmpty {...stylex.props(styles.empty)}>{empty}</CommandEmpty>
          </Command>
        </div>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

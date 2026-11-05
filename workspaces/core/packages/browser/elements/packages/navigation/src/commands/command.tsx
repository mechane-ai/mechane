import { Autocomplete } from '@base-ui/react/autocomplete';
import * as stylex from '@stylexjs/stylex';
import { useFormatForDisplay, useHotkeys } from '@tanstack/react-hotkeys';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { Input } from '../../../forms/src/index.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
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
  readonly onSelect: () => void;
};

export type CommandShortcutsOptions = {
  readonly commands: ReadonlyArray<CommandAction>;
  readonly target: RefObject<HTMLElement | null> | HTMLElement | null;
  readonly isEnabled: boolean;
};

export function useCommandShortcuts({ commands, target, isEnabled }: CommandShortcutsOptions): void {
  const bindings = commands.flatMap((command) => {
    if (!isEnabled || command.isDisabled === true || command.shortcut === undefined) {
      return [];
    }

    return [
      {
        hotkey: command.shortcut,
        callback: (event: KeyboardEvent) => {
          if (event.defaultPrevented || event.repeat) {
            return;
          }

          const region = target !== null && 'current' in target ? target.current : target;

          const modal =
            event.target instanceof Element
              ? event.target.closest('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')
              : null;

          if (modal !== null && (region === null || !modal.contains(region))) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          command.onSelect();
        },
        options: { requireReset: true, meta: { name: command.label } },
      },
    ];
  });

  useHotkeys(bindings, {
    target,
    ignoreInputs: true,
    ignoreDefaultPrevented: true,
    preventDefault: false,
    stopPropagation: false,
    conflictBehavior: 'error',
  });
}

export type ShortcutHintProps = { readonly shortcut: CommandShortcut };

export function ShortcutHint({ shortcut }: ShortcutHintProps): ReactNode {
  const format = useFormatForDisplay();

  return <Kbd>{format(shortcut)}</Kbd>;
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
      <Dialog.Portal>
        <Dialog.Backdrop motion="none" />
        <Dialog.Popup motion="none">
          <div {...stylex.props(styles.content)}>
            <Dialog.Title>{title}</Dialog.Title>
            <Autocomplete.Root
              items={commands}
              itemToStringValue={(command) => command.label}
              inline
              open
              autoHighlight="always"
            >
              <Autocomplete.Input aria-label={placeholder} placeholder={placeholder} render={<Input />} />
              <Autocomplete.List {...stylex.props(styles.list)}>
                {(command: CommandAction) => (
                  <Autocomplete.Item
                    key={command.id}
                    value={command}
                    disabled={command.isDisabled}
                    {...stylex.props(styles.item)}
                    onClick={() => {
                      onOpenChange(false);
                      command.onSelect();
                    }}
                  >
                    <span {...stylex.props(styles.text)}>
                      {command.label}
                      {command.description !== undefined && (
                        <span {...stylex.props(styles.description)}>{command.description}</span>
                      )}
                    </span>
                    {command.shortcut !== undefined && <ShortcutHint shortcut={command.shortcut} />}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
              <Autocomplete.Empty {...stylex.props(styles.empty)}>{empty}</Autocomplete.Empty>
            </Autocomplete.Root>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

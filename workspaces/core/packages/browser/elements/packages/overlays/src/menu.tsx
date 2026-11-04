import { Menu as BaseMenu } from '@base-ui/react/menu';
import * as stylex from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import type { OpenStateProperties } from '../../foundations/src/control-state.ts';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';

type MenuRootProps<Payload> = Omit<BaseMenu.Root.Props<Payload>, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BaseMenu.Root.Props<Payload>['onOpenChange']>>;

type MenuPositionerProps = ComponentProps<typeof BaseMenu.Positioner>;
type MenuPopupProps = ComponentProps<typeof BaseMenu.Popup>;
type MenuItemProps = ComponentProps<typeof BaseMenu.Item>;
type MenuLinkItemProps = ComponentProps<typeof BaseMenu.LinkItem>;
type MenuGroupLabelProps = ComponentProps<typeof BaseMenu.GroupLabel>;
type MenuSeparatorProps = ComponentProps<typeof BaseMenu.Separator>;

type MenuCheckboxItemProps = Omit<
  ComponentProps<typeof BaseMenu.CheckboxItem>,
  'checked' | 'defaultChecked' | 'onCheckedChange'
> & {
  readonly checked: boolean;
  readonly onCheckedChange: NonNullable<BaseMenu.CheckboxItem.Props['onCheckedChange']>;
};

type MenuRadioGroupProps = Omit<
  ComponentProps<typeof BaseMenu.RadioGroup>,
  'value' | 'defaultValue' | 'onValueChange'
> & { readonly value: string; readonly onValueChange: NonNullable<BaseMenu.RadioGroup.Props['onValueChange']> };

type MenuRadioItemProps = ComponentProps<typeof BaseMenu.RadioItem>;
type MenuSubmenuTriggerProps = ComponentProps<typeof BaseMenu.SubmenuTrigger>;

type MenuSubmenuRootProps = Omit<BaseMenu.SubmenuRoot.Props, 'open' | 'defaultOpen' | 'onOpenChange'> &
  OpenStateProperties<NonNullable<BaseMenu.SubmenuRoot.Props['onOpenChange']>>;

function MenuRoot<Payload = unknown>(props: MenuRootProps<Payload>): ReactNode {
  return <BaseMenu.Root<Payload> {...props} />;
}

function MenuSubmenuRoot(props: MenuSubmenuRootProps): ReactNode {
  return <BaseMenu.SubmenuRoot {...props} />;
}

function MenuPositioner({ className, style, sideOffset = 4, ...props }: MenuPositionerProps): ReactNode {
  return (
    <BaseMenu.Positioner
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<BaseMenu.Positioner.State>({ className, style, styles: stylex.props(popupStyles.positioner) })}
    />
  );
}

function MenuPopup({ className, style, ...props }: MenuPopupProps): ReactNode {
  return (
    <BaseMenu.Popup
      {...props}
      {...mergeStyles<BaseMenu.Popup.State>({
        className,
        style,
        styles: stylex.props(popupStyles.surface, popupStyles.menu),
      })}
    />
  );
}

function MenuItem({ className, style, ...props }: MenuItemProps): ReactNode {
  return (
    <BaseMenu.Item
      {...props}
      {...mergeStyles<BaseMenu.Item.State>({ className, style, styles: stylex.props(popupStyles.item) })}
    />
  );
}

function MenuLinkItem({ className, style, ...props }: MenuLinkItemProps): ReactNode {
  return (
    <BaseMenu.LinkItem
      {...props}
      {...mergeStyles<BaseMenu.LinkItem.State>({ className, style, styles: stylex.props(popupStyles.item) })}
    />
  );
}

function MenuGroupLabel({ className, style, ...props }: MenuGroupLabelProps): ReactNode {
  return (
    <BaseMenu.GroupLabel
      {...props}
      {...mergeStyles<BaseMenu.GroupLabel.State>({ className, style, styles: stylex.props(popupStyles.label) })}
    />
  );
}

function MenuSeparator({ className, style, ...props }: MenuSeparatorProps): ReactNode {
  return (
    <BaseMenu.Separator
      {...props}
      {...mergeStyles<BaseMenu.Separator.State>({ className, style, styles: stylex.props(popupStyles.separator) })}
    />
  );
}

function MenuCheckboxItem({ className, style, children, ...props }: MenuCheckboxItemProps): ReactNode {
  return (
    <BaseMenu.CheckboxItem
      {...props}
      {...mergeStyles<BaseMenu.CheckboxItem.State>({ className, style, styles: stylex.props(popupStyles.item) })}
    >
      <span {...stylex.props(popupStyles.indicator)}>
        <BaseMenu.CheckboxItemIndicator>
          <Check size={14} aria-hidden />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseMenu.CheckboxItem>
  );
}

function MenuRadioGroup(props: MenuRadioGroupProps): ReactNode {
  return <BaseMenu.RadioGroup {...props} />;
}

function MenuRadioItem({ className, style, children, ...props }: MenuRadioItemProps): ReactNode {
  return (
    <BaseMenu.RadioItem
      {...props}
      {...mergeStyles<BaseMenu.RadioItem.State>({ className, style, styles: stylex.props(popupStyles.item) })}
    >
      <span {...stylex.props(popupStyles.indicator)}>
        <BaseMenu.RadioItemIndicator>
          <Check size={14} aria-hidden />
        </BaseMenu.RadioItemIndicator>
      </span>
      {children}
    </BaseMenu.RadioItem>
  );
}

function MenuSubmenuTrigger({ className, style, ...props }: MenuSubmenuTriggerProps): ReactNode {
  return (
    <BaseMenu.SubmenuTrigger
      {...props}
      {...mergeStyles<BaseMenu.SubmenuTrigger.State>({ className, style, styles: stylex.props(popupStyles.item) })}
    />
  );
}

export const Menu = {
  Root: MenuRoot,
  Trigger: BaseMenu.Trigger,
  Portal: BaseMenu.Portal,
  Positioner: MenuPositioner,
  Popup: MenuPopup,
  Item: MenuItem,
  LinkItem: MenuLinkItem,
  Group: BaseMenu.Group,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  SubmenuRoot: MenuSubmenuRoot,
  SubmenuTrigger: MenuSubmenuTrigger,
};

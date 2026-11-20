import * as stylex from '@stylexjs/stylex';
import * as SDK from '@ui-sdk/react/menu';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { popupStyles } from '../../foundations/src/popup-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import { withOverlayPortal } from './overlay-root.tsx';
import type { OpenProps } from './overlay-root.tsx';

function Root(props: OpenProps<SDK.MenuProps>): ReactNode {
  return <SDK.Menu {...props} />;
}

function SubmenuRoot(props: OpenProps<SDK.MenuSubProps>): ReactNode {
  return <SDK.MenuSub {...props} />;
}

function Popup({ className, style, sideOffset = 4, ...props }: ComponentProps<typeof SDK.MenuContent>): ReactNode {
  return (
    <SDK.MenuContent
      {...props}
      sideOffset={sideOffset}
      {...mergeStyles<SDK.MenuContentState>({
        className,
        style,
        styles: stylex.props(popupStyles.positioner, popupStyles.surface, popupStyles.menu),
      })}
    />
  );
}

type ItemProps = Omit<ComponentProps<typeof SDK.MenuItem>, 'onClick'>;

function Item({ className, style, ...props }: ItemProps): ReactNode {
  return (
    <SDK.MenuItem
      {...props}
      {...mergeStyles<SDK.MenuItemState>({ className, style, styles: stylex.props(popupStyles.item) })}
    />
  );
}

type LinkItemProps = Omit<ItemProps, 'render'> &
  Pick<ComponentProps<'a'>, 'target' | 'rel'> & { readonly href: string };

function LinkItem({ href, target, rel, ...props }: LinkItemProps): ReactNode {
  return <Item {...props} render={<a href={href} target={target} rel={rel} />} />;
}

function GroupLabel({ className, style, ...props }: ComponentProps<typeof SDK.MenuGroupLabel>): ReactNode {
  return (
    <SDK.MenuGroupLabel {...props} {...mergeStyles({ className, style, styles: stylex.props(popupStyles.label) })} />
  );
}

function Separator({ className, style, ...props }: ComponentProps<typeof SDK.MenuSeparator>): ReactNode {
  return (
    <SDK.MenuSeparator {...props} {...mergeStyles({ className, style, styles: stylex.props(popupStyles.separator) })} />
  );
}

function Indicator(): ReactNode {
  return (
    <span {...stylex.props(popupStyles.indicator)}>
      <SDK.MenuItemIndicator>
        <Check size={14} aria-hidden />
      </SDK.MenuItemIndicator>
    </span>
  );
}

type CheckboxItemProps = Omit<
  ComponentProps<typeof SDK.MenuCheckboxItem>,
  'children' | 'defaultChecked' | 'checked' | 'onCheckedChange'
> & {
  readonly checked: boolean;
  readonly onCheckedChange: NonNullable<SDK.MenuCheckboxItemProps['onCheckedChange']>;
  readonly children?: ReactNode;
};

function CheckboxItem({ className, style, children, ...props }: CheckboxItemProps): ReactNode {
  return (
    <SDK.MenuCheckboxItem
      {...props}
      {...mergeStyles<SDK.MenuCheckboxItemState>({ className, style, styles: stylex.props(popupStyles.item) })}
    >
      <Indicator />
      {children}
    </SDK.MenuCheckboxItem>
  );
}

type RadioGroupProps<T extends string> = Omit<
  ComponentProps<typeof SDK.MenuRadioGroup<T>>,
  'defaultValue' | 'value' | 'onValueChange'
> & { readonly value: T; readonly onValueChange: NonNullable<SDK.MenuRadioGroupProps<T>['onValueChange']> };

function RadioGroup<T extends string>(props: RadioGroupProps<T>): ReactNode {
  return <SDK.MenuRadioGroup<T> {...props} />;
}

function RadioItem({
  children,
  className,
  style,
  ...props
}: Omit<ComponentProps<typeof SDK.MenuRadioItem>, 'children'> & { readonly children?: ReactNode }): ReactNode {
  return (
    <SDK.MenuRadioItem
      {...props}
      {...mergeStyles<SDK.MenuRadioItemState>({ className, style, styles: stylex.props(popupStyles.item) })}
    >
      <Indicator />
      {children}
    </SDK.MenuRadioItem>
  );
}

function SubmenuTrigger({ className, style, ...props }: ComponentProps<typeof SDK.MenuSubTrigger>): ReactNode {
  return (
    <SDK.MenuSubTrigger
      {...props}
      {...mergeStyles<SDK.MenuTriggerState>({ className, style, styles: stylex.props(popupStyles.item) })}
    />
  );
}

export const Menu = {
  Root: withOverlayPortal(Root),
  Trigger: SDK.MenuTrigger,
  Popup,
  Item,
  LinkItem,
  Group: SDK.MenuGroup,
  GroupLabel,
  Separator,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  SubmenuRoot,
  SubmenuTrigger,
};

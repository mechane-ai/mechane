import { Toolbar, ToolbarButton, ToolbarGroup } from '@ui-sdk/react/toolbar';
import { createContext, useContext } from 'react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

const ToolbarScope = createContext(false);

type ControlToolbarProps = ComponentProps<typeof ToolbarGroup> & { readonly 'aria-label': string };

/**
 * A named set of controls on the UI SDK toolbar: Tab enters once and the arrow keys move between the controls. Inside
 * another set it becomes a group of that toolbar, so a row of sets still has one Tab stop.
 */
export function ControlToolbar(props: ControlToolbarProps): ReactNode {
  if (useContext(ToolbarScope)) {
    return <ToolbarGroup {...props} />;
  }

  return (
    <ToolbarScope value>
      <Toolbar {...props} />
    </ToolbarScope>
  );
}

/** Joins a button to the toolbar around it. Outside a toolbar the button renders as given. */
export function useToolbarButton(button: ReactElement): ReactElement {
  return useContext(ToolbarScope) ? <ToolbarButton render={button} /> : button;
}

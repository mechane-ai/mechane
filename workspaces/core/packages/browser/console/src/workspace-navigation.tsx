import { AgentAvatar } from '@mechane-ai/elements';
import { Navigation, NavigationLink, NavigationSection } from '@mechane-ai/elements/layout';
import { canRetainResult } from '@mechane/console-data';
import type { ConsoleData } from '@mechane/console-data';
import type { Mech } from '@mechane/protocol';
import { createLink } from '@tanstack/react-router';
import { Grid2X2, Settings } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMechAppearance } from './mech-appearance.tsx';
import { useNavigationPreferences } from './navigation-preferences.tsx';
import { useResource } from './resource.tsx';
import type { ConsoleLocation } from './types.ts';
import { useMechNavigationResource } from './use-mech-navigation-resource.ts';

const WorkspaceLink = createLink(NavigationLink);

export function WorkspaceNavigation({
  data,
  location,
}: {
  readonly data: ConsoleData;
  readonly location: ConsoleLocation;
}): ReactNode {
  const { pinned, recent } = useNavigationPreferences();

  return (
    <Navigation label="Workspace">
      <NavigationSection label="Overview">
        <WorkspaceLink
          to="/"
          search={{ workspace: data.workspace.id }}
          selected={location.mech === undefined && location.view !== 'definition'}
          icon={<Grid2X2 size={16} aria-hidden />}
        >
          Mechs
        </WorkspaceLink>
      </NavigationSection>
      {pinned.length > 0 && (
        <NavigationSection label="Pinned">
          {pinned.map((id) => (
            <MechShortcut key={id} data={data} mechId={id} selected={location.mech === id} />
          ))}
        </NavigationSection>
      )}
      {recent.length > 0 && (
        <NavigationSection label="Recent">
          {recent
            .filter((id) => !pinned.includes(id))
            .map((id) => (
              <MechShortcut key={id} data={data} mechId={id} selected={location.mech === id} />
            ))}
        </NavigationSection>
      )}
      <NavigationSection label="Workspace">
        <WorkspaceLink
          to="/"
          search={{ workspace: data.workspace.id, view: 'definition' }}
          selected={location.mech === undefined && location.view === 'definition'}
          icon={<Settings size={16} aria-hidden />}
        >
          Settings
        </WorkspaceLink>
      </NavigationSection>
    </Navigation>
  );
}

function MechShortcut({
  data,
  mechId,
  selected,
}: {
  readonly data: ConsoleData;
  readonly mechId: Mech['id'];
  readonly selected: boolean;
}): ReactNode {
  const source = useMemo(() => data.mech(mechId), [data, mechId]);
  const state = useResource(data, source);
  const { appearance } = useMechAppearance(mechId);
  const removed = state.kind === 'failed' && !canRetainResult(state.problem);

  useMechNavigationResource({ source, mechId });

  if (removed) {
    return null;
  }

  function shortcutLabel(): string {
    switch (state.kind) {
      case 'ready':
      case 'stale':
        return state.value.name;
      case 'pending':
        return 'Loading mech…';
      case 'failed':
        return 'Mech unavailable';
    }
  }

  return (
    <WorkspaceLink
      to="/"
      search={{ workspace: data.workspace.id, mech: mechId }}
      selected={selected}
      icon={<AgentAvatar seed={mechId} appearance={appearance} size="sm" />}
    >
      {shortcutLabel()}
    </WorkspaceLink>
  );
}

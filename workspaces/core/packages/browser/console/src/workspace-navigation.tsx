import { AgentAvatar } from '@mechane-ai/elements';
import { Skeleton } from '@mechane-ai/elements/feedback';
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
import { useMech } from './reads.ts';
import { ResourceView } from './resource.tsx';
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
          isSelected={location.mech === undefined && location.view !== 'definition'}
          icon={<Grid2X2 size={16} aria-hidden />}
        >
          Mechs
        </WorkspaceLink>
      </NavigationSection>
      {pinned.length > 0 && (
        <NavigationSection label="Pinned">
          {pinned.map((id) => (
            <MechShortcut key={id} data={data} mechId={id} isSelected={location.mech === id} />
          ))}
        </NavigationSection>
      )}
      {recent.length > 0 && (
        <NavigationSection label="Recent">
          {recent
            .filter((id) => !pinned.includes(id))
            .map((id) => (
              <MechShortcut key={id} data={data} mechId={id} isSelected={location.mech === id} />
            ))}
        </NavigationSection>
      )}
    </Navigation>
  );
}

export function WorkspaceAccount({
  workspaceId,
  name,
  location,
}: {
  readonly workspaceId: string;
  readonly name: string;
  readonly location: ConsoleLocation;
}): ReactNode {
  return (
    <WorkspaceLink
      to="/"
      search={{ workspace: workspaceId, view: 'definition' }}
      isSelected={location.mech === undefined && location.view === 'definition'}
      icon={<Settings size={16} aria-hidden />}
      aria-label={`Settings for ${name}`}
      title={`${name} · Settings`}
    >
      {name}
    </WorkspaceLink>
  );
}

function MechShortcut({
  data,
  mechId,
  isSelected,
}: {
  readonly data: ConsoleData;
  readonly mechId: Mech['id'];
  readonly isSelected: boolean;
}): ReactNode {
  const request = useMemo(() => data.reads.mech(mechId), [data, mechId]);
  const state = useMech(data, request);
  const { appearance } = useMechAppearance(mechId);
  const isRemoved = state.kind === 'failed' && !canRetainResult(state.problem);

  useMechNavigationResource({ state, mechId });

  if (isRemoved) {
    return null;
  }

  const icon = <AgentAvatar seed={mechId} appearance={appearance} size="sm" />;

  return (
    <ResourceView
      state={state}
      label="Loading mech shortcut"
      placeholder={
        <NavigationLink icon={icon}>
          <Skeleton width={96} />
        </NavigationLink>
      }
      failure={
        <WorkspaceLink to="/" search={{ workspace: data.workspace.id, mech: mechId }} icon={icon}>
          Mech unavailable
        </WorkspaceLink>
      }
    >
      {(mech) => (
        <WorkspaceLink
          to="/"
          search={{ workspace: data.workspace.id, mech: mechId }}
          isSelected={isSelected}
          icon={icon}
        >
          {mech.name}
        </WorkspaceLink>
      )}
    </ResourceView>
  );
}

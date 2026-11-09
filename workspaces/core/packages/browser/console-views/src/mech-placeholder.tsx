import { PromptInputPlaceholder } from '@mechane-ai/elements/ai';
import { CollectionToolbar } from '@mechane-ai/elements/collections';
import { ButtonPlaceholder, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageToolbar, Workbench, WorkbenchFooter, WorkbenchScroll } from '@mechane-ai/elements/layout';
import { PageNavigationPlaceholder } from '@mechane-ai/elements/navigation';
import type { ConsoleView } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { ConversationPlaceholder } from './conversation.tsx';
import { EnvironmentPlaceholder } from './environment.tsx';
import { ActivityPlaceholder } from './events.tsx';
import { MechHeaderPlaceholder } from './mech-header.tsx';
import { MechSettingsPlaceholder } from './mech-settings.tsx';
import { TurnTracePlaceholder } from './trace.tsx';
import type { TraceTab } from './trace.tsx';
import { TurnListPlaceholder } from './turns.tsx';

const collectionViews: ReadonlySet<ConsoleView> = new Set(['runs', 'activity']);

export function MechPagePlaceholder({
  view,
  hasFocusedRun = false,
  traceTab = 'Overview',
}: {
  readonly view: ConsoleView;
  readonly hasFocusedRun?: boolean;
  readonly traceTab?: TraceTab;
}): ReactNode {
  if (hasFocusedRun) {
    return (
      <>
        <PageToolbar
          showNavigation={false}
          title={<SkeletonText width="16ch" />}
          leading={<ButtonPlaceholder width="6ch" />}
        />
        <Workbench>
          <WorkbenchScroll label="Run details">
            <TurnTracePlaceholder tab={traceTab} />
          </WorkbenchScroll>
        </Workbench>
      </>
    );
  }

  return (
    <>
      <MechHeaderPlaceholder />
      <Workbench>
        {view === 'conversation' ? (
          <>
            <ConversationPlaceholder />
            <WorkbenchFooter>
              <PromptInputPlaceholder isCompact />
            </WorkbenchFooter>
          </>
        ) : (
          <WorkbenchScroll label="Mech content" isFlush={collectionViews.has(view)}>
            {collectionViews.has(view) && (
              <CollectionToolbar label="Activity views">
                <PageNavigationPlaceholder
                  isEmbedded
                  items={[
                    { id: 'activity', label: 'Events' },
                    { id: 'runs', label: 'Runs' },
                  ]}
                />
              </CollectionToolbar>
            )}
            <MechContentPlaceholder view={view} />
          </WorkbenchScroll>
        )}
      </Workbench>
    </>
  );
}

function MechContentPlaceholder({ view }: { readonly view: ConsoleView }): ReactNode {
  switch (view) {
    case 'runs':
      return <TurnListPlaceholder />;
    case 'environment':
      return <EnvironmentPlaceholder />;
    case 'activity':
      return <ActivityPlaceholder />;
    case 'definition':
      return <MechSettingsPlaceholder />;
    case 'conversation':
    case 'requests':
    case 'events':
    case 'tools':
      return <ConversationPlaceholder />;
  }
}

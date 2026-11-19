import { ButtonPlaceholder, SkeletonText } from '@mechane-ai/elements/feedback';
import { PageLayout, Workbench, WorkbenchScroll } from '@mechane-ai/elements/layout';
import type { ConsoleView } from '@mechane/protocol';
import type { ReactNode } from 'react';
import { ConversationPlaceholder } from './conversation.tsx';
import { EnvironmentPlaceholder } from './environment.tsx';
import { ActivityPlaceholder } from './events.tsx';
import { TurnTracePlaceholder } from './trace.tsx';
import type { TraceTab } from './trace.tsx';
import { TurnListPlaceholder } from './turns.tsx';

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
      <PageLayout
        showNavigation={false}
        title={<SkeletonText width="16ch" />}
        leading={<ButtonPlaceholder width="6ch" />}
      >
        <Workbench>
          <WorkbenchScroll label="Run details">
            <TurnTracePlaceholder tab={traceTab} />
          </WorkbenchScroll>
        </Workbench>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={<SkeletonText width="16ch" />}
      navigation={{
        isPlaceholder: true,
        items: [
          { id: 'runs', label: 'Runs' },
          { id: 'activity', label: 'Events' },
          { id: 'environment', label: 'Environment' },
          { id: 'conversation', label: 'Archive' },
        ],
      }}
    >
      <Workbench>
        {view === 'conversation' ? (
          <ConversationPlaceholder />
        ) : (
          <WorkbenchScroll label="Diagnostics" isFlush={view !== 'environment'}>
            {view === 'environment' ? (
              <EnvironmentPlaceholder />
            ) : view === 'activity' ? (
              <ActivityPlaceholder />
            ) : (
              <TurnListPlaceholder />
            )}
          </WorkbenchScroll>
        )}
      </Workbench>
    </PageLayout>
  );
}

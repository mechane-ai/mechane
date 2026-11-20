import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabbedWorkspace } from '../../../recipes/tabbed-workspace.tsx';
import { useStoryLocation } from './use-story-location.ts';

const meta = {
  title: 'Recipes/Tabbed Workspace',
  component: TabbedWorkspace,
  tags: ['autodocs', 'manifest'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TabbedWorkspace>;

export default meta;

function WorkspaceExample() {
  const route = useStoryLocation();
  const view = route === '#project-overview' ? 'overview' : 'activity';

  return (
    <TabbedWorkspace
      project="Release notes"
      summary="Changes included in the next release."
      owner="Documentation team"
      currentView={view}
      views={[
        { id: 'overview', label: 'Overview', href: '#project-overview' },
        { id: 'activity', label: 'Activity', href: '#project-activity' },
      ]}
      events={[
        { id: 'review', description: 'Maya requested a review.' },
        { id: 'approve', description: 'Lee approved the notes.' },
      ]}
    />
  );
}

export const Example: StoryObj = { render: () => <WorkspaceExample /> };

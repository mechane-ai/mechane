import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './actions.tsx';
import { Field, Input } from './forms.tsx';
import { Checkbox } from './selection.tsx';
import { Notice, Panel, Row, Stack } from './surfaces.tsx';
import { Text } from './text.tsx';
import { themeProps } from './theme.ts';

const meta = {
  title: 'Foundations/Color scheme',
  parameters: {
    docs: {
      description: {
        component:
          'Supported. Spread themeProps.light or themeProps.dark onto the document root. All token roles use that explicit color scheme, including native controls, charts, syntax, and portaled overlays. Light is the default. Theme selection and persistence belong to the application. A local themed subtree is useful for a preview, but its portals still inherit their destination; theme the document root for a complete application.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Dark: Story = {
  render: () => (
    <div {...themeProps.dark}>
      <Panel>
        <Stack>
          <Text>Dark uses the same geometry and semantic color roles as light.</Text>
          <Field.Root>
            <Field.Label>Workspace name</Field.Label>
            <Input defaultValue="Research workspace" />
          </Field.Root>
          <Field.Root>
            <Field.Label>
              <Checkbox.Root defaultChecked>
                <Checkbox.Indicator />
              </Checkbox.Root>{' '}
              Include archived records
            </Field.Label>
          </Field.Root>
          <Notice error>The refresh failed. Your current results remain available.</Notice>
          <Row>
            <Button variant="solid">Save changes</Button>
            <Button variant="outline">Cancel</Button>
          </Row>
        </Stack>
      </Panel>
    </div>
  ),
};

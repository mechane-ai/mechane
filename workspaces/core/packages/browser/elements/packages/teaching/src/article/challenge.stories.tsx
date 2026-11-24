import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentPanel } from '../../../../src/stories/agent-panel.tsx';
import { NeuronCurve, neuronLesson, StoryPage } from '../../../../src/stories/neuron-lesson.tsx';
import { Param, Value } from '../lesson/param.tsx';
import { Article } from './article.tsx';
import { Beat } from './beat.tsx';
import { Challenge } from './challenge.tsx';
import { Figure } from './figure.tsx';

const REACHED_OUTPUT = 0.9;

const meta = {
  title: 'Teaching/Challenge',
  component: Challenge,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Challenge sets the reader a task met by changing the lesson’s values, with hints on request, and shows what they find once reached. Only the reader’s own change reaches it: the panel below sends the same change through the agent bridge, and the challenge stays open. The author supplies the prompt, `isReached` over the lesson’s values, and the outcome; the neuron here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <StoryPage>
      <Article lesson={neuronLesson} locale="en-US" title="Push the neuron">
        <Beat id="neuron">
          <p>
            The neuron has a weight of <Param name="weight" /> and a bias of <Param name="bias" />. At input 1 it
            outputs <Value name="output" />.
          </p>
          <Challenge
            id="confident"
            prompt="Make the neuron output at least 0.9 at input 1."
            isReached={(values) => Number(values['output']) >= REACHED_OUTPUT}
            hints={['The output is the sigmoid of weight plus bias.', 'A bias of 2 is enough on its own.']}
          >
            <p>
              Weight plus bias is now above 2.2, where the sigmoid passes 0.9. Any mix of the two that sums that high
              works.
            </p>
          </Challenge>
          <Figure
            id="curve"
            caption="The neuron’s output across inputs."
            description="An S-shaped curve from 0 to 1."
            reads={['weight', 'bias']}
          >
            <NeuronCurve />
          </Figure>
        </Beat>
      </Article>
      <AgentPanel
        ask="Ask the agent for bias 2"
        steps={[{ ref: neuronLesson.title, action: 'setParam', args: ['bias', 2] }]}
      />
    </StoryPage>
  ),
};

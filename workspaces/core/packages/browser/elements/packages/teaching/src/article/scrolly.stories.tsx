import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeuronCurve, neuronLesson, StoryPage } from '../../../../src/stories/neuron-lesson.tsx';
import { Value } from '../lesson/param.tsx';
import type { ArticleView } from './article-context.ts';
import { Article } from './article.tsx';
import { Beat } from './beat.tsx';
import { Figure } from './figure.tsx';
import { Scrolly, ScrollyStep } from './scrolly.tsx';

const meta = {
  title: 'Teaching/Scrolly',
  component: Scrolly,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Scrolly keeps a figure in view while the reader scrolls through steps of prose beside it; the step in view sets the lesson’s values or shows a beat state, and the figure moves there. The static view prints each step with the figure at its values. The author supplies the figure and the steps; the neuron here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Walkthrough({ view }: { readonly view: ArticleView }) {
  return (
    <StoryPage>
      <Article lesson={neuronLesson} locale="en-US" title="Three weights" view={view}>
        <Beat id="neuron">
          <p>
            Scroll through three weights and watch the curve follow. The output at input 1 is <Value name="output" />.
          </p>
          <Scrolly
            figure={
              <Figure
                id="curve"
                caption="The neuron’s output across inputs."
                description="An S-shaped curve whose steepness follows the weight."
                reads={['weight', 'bias']}
              >
                <NeuronCurve />
              </Figure>
            }
          >
            <ScrollyStep id="flat" state="flat">
              <p>A negative weight turns the curve around: larger inputs give smaller outputs.</p>
            </ScrollyStep>
            <ScrollyStep id="gentle" state="gentle">
              <p>A small positive weight gives a gentle rise across the whole range.</p>
            </ScrollyStep>
            <ScrollyStep id="steep" values={{ weight: 2, bias: -1 }}>
              <p>A weight of 2 with a bias of −1 makes a steep step just right of zero.</p>
            </ScrollyStep>
          </Scrolly>
          <p>
            After the steps, the values stay where the last one left them: output <Value name="output" />.
          </p>
        </Beat>
      </Article>
    </StoryPage>
  );
}

export const Default: Story = { render: () => <Walkthrough view="article" /> };

export const Static: Story = { render: () => <Walkthrough view="static" /> };

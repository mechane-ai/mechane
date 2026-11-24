import type { Meta, StoryObj } from '@storybook/react-vite';
import { NeuronCurve, neuronLesson, StoryPage } from '../../../../src/stories/neuron-lesson.tsx';
import { Param, Value } from '../lesson/param.tsx';
import { Article } from './article.tsx';
import { Beat } from './beat.tsx';
import { Figure } from './figure.tsx';
import { Predict } from './predict.tsx';

const meta = {
  title: 'Teaching/Predict',
  component: Predict,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Predict asks the reader to commit a guess, among options or as a number, before the answer and the explanation show. The guess, the answer and whether it was right are kept in the reader’s progress, under the article’s storage key; an agent never commits for the reader. The author supplies the question, the answer or the lesson value it comes from, and the explanation; the neuron here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <StoryPage>
      <Article lesson={neuronLesson} locale="en-US" title="Guess before you look" storageKey="teaching-predict-story">
        <Beat id="neuron">
          <p>
            A neuron multiplies its input by a weight of <Param name="weight" />, adds a bias of <Param name="bias" />,
            and squashes the sum with a sigmoid. At input 1 it outputs <Value name="output" />.
          </p>
          <Predict
            id="double-weight"
            prompt="Double the weight. What happens to the curve?"
            options={[
              { id: 'steeper', label: 'It gets steeper around its middle' },
              { id: 'shifts', label: 'It shifts to the left' },
              { id: 'higher', label: 'It rises above 1 for large inputs' },
            ]}
            answer="steeper"
          >
            <p>
              The weight scales the input, so the same change in input moves the sum twice as far. The bias shifts it.
            </p>
          </Predict>
          <Predict
            id="output-guess"
            prompt="With the weight and bias as they are now, what does the neuron output at input 1?"
            min={0}
            max={1}
            step={0.01}
            format={{ maximumFractionDigits: 2 }}
            answerFrom="output"
            tolerance={0.05}
          >
            <p>The output is the sigmoid of weight plus bias. Read it off the curve at the marked input.</p>
          </Predict>
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
    </StoryPage>
  ),
};

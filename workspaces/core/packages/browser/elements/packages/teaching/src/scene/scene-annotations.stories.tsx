import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { RuleMark } from '../../../charts/src/plot/index.ts';
import { SegmentedControl } from '../../../forms/src/index.ts';
import { SceneBracket } from './scene-bracket.tsx';
import { SceneCallout } from './scene-callout.tsx';
import { SceneCustom } from './scene-custom.tsx';
import { SceneGroup } from './scene-group.tsx';
import { SceneHighlight } from './scene-highlight.tsx';
import { SceneNode } from './scene-node.tsx';
import { SceneWire } from './scene-wire.tsx';
import { Scene } from './scene.tsx';

const meta = {
  title: 'Teaching/SceneAnnotations',
  component: SceneGroup,
  parameters: {
    docs: {
      description: {
        component:
          'The parts that explain a scene rather than make it up. SceneGroup outlines members, SceneBracket spans them along one side, SceneCallout attaches prose by a leader line, SceneHighlight draws a halo, and SceneCustom draws SVG with the scene’s scales. Each follows its objects by id as they move.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const layers = [
  { id: 'in', column: 0, units: ['i1', 'i2', 'i3'] },
  { id: 'hidden', column: 1.5, units: ['h1', 'h2', 'h3', 'h4'] },
] as const;

function Network({ focus }: { readonly focus: 'none' | 'hidden' | 'output' }): ReactNode {
  return (
    <Scene
      title="A small network, annotated"
      description="Synthetic network with three inputs, four hidden units and one output. Hover or step through the parts."
      locale="en-US"
      x={[0, 3]}
      y={[0, 4]}
      height="tall"
      focus={focus === 'output' ? ['h4', 'out'] : null}
    >
      {layers.map((layer) =>
        layer.units.map((unit, index) => (
          <SceneNode
            key={unit}
            id={unit}
            at={[layer.column, 3.4 - index * (layer.units.length === 3 ? 1.2 : 0.9)]}
            size="small"
            shape="circle"
            text={unit}
            isCode
            label={`${layer.id === 'in' ? 'Input' : 'Hidden unit'} ${unit}`}
          />
        )),
      )}
      <SceneNode id="out" at={[3, 2]} shape="pill" size="small" text="ŷ" label="Output ŷ" tone="series1" />
      {layers[0].units.flatMap((input, row) =>
        layers[1].units.map((unit, column) => (
          <SceneWire
            key={`${input}>${unit}`}
            from={input}
            to={unit}
            weight={Math.round(Math.sin((row + 1) * (column + 2)) * 10) / 10}
            hasArrow={false}
          />
        )),
      )}
      {layers[1].units.map((unit) => (
        <SceneWire key={unit} from={unit} to="out" hasArrow={false} />
      ))}
      <SceneGroup id="inputs" label="Input layer" around={layers[0].units} />
      <SceneBracket of={layers[1].units} side="bottom" label="Hidden layer, four units" text="4 hidden units" />
      <SceneHighlight of="out" isShown={focus !== 'none'} tone="series1" />
      <SceneHighlight of={layers[1].units} isShown={focus === 'hidden'} />
      <SceneCallout to="out" side="bottom">
        The output is one number: the network’s guess.
      </SceneCallout>
      <SceneCustom layer="back">
        {({ x, box }) => (
          <RuleMark x1={x.position(2.25)} y1={box.top} x2={x.position(2.25)} y2={box.bottom} stroke="dashed" />
        )}
      </SceneCustom>
    </Scene>
  );
}

const highlights: Readonly<Record<string, 'none' | 'hidden' | 'output' | undefined>> = {
  none: 'none',
  hidden: 'hidden',
  output: 'output',
};

function Annotated(): ReactNode {
  const [focus, setFocus] = useState<'none' | 'hidden' | 'output'>('none');

  return (
    <div>
      <SegmentedControl.Root
        value={focus}
        onValueChange={(value) => setFocus(highlights[value] ?? 'none')}
        aria-label="Highlight"
      >
        <SegmentedControl.Item value="none">Plain</SegmentedControl.Item>
        <SegmentedControl.Item value="hidden">Hidden layer</SegmentedControl.Item>
        <SegmentedControl.Item value="output">Output</SegmentedControl.Item>
      </SegmentedControl.Root>
      <Network focus={focus} />
    </div>
  );
}

export const Together: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A group around the inputs, a bracket under the hidden layer, a callout on the output, halos that fade in, and a custom dashed guide.',
      },
    },
  },
  render: () => <Annotated />,
};

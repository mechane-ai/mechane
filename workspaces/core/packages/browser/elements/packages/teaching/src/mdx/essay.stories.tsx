import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { standInMath } from '../../../../src/stories/temperature-essay.tsx';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { defineLesson } from '../lesson/index.ts';
import { essayComponents } from './essay-components.ts';
import { Essay } from './essay.tsx';
import type { EssayMeta } from './essay.tsx';

const meta = {
  title: 'Teaching/Essay',
  component: Essay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Essay renders an MDX file as an article: `essayComponents` gives Markdown the article’s typography and every teaching part its own name, so the file needs no imports. The application compiles the MDX; these stories use a hand-written stand-in for the compiled file, built from the same components. Choose the view with the `view` prop or `?view=` in the address. The text is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const styles = stylex.create({ page: { paddingBlock: spacing.xl, paddingInline: spacing.lg } });

const lesson = defineLesson({
  id: 'markdown-typography',
  title: 'Markdown in an essay',
  params: {
    width: {
      kind: 'number',
      label: 'Layer width',
      value: 64,
      min: 8,
      max: 512,
      step: 8,
      format: { maximumFractionDigits: 0 },
    },
  },
  derived: {
    weights: {
      label: 'Weights in one layer',
      format: { maximumFractionDigits: 0 },
      from: (values) => values.width * values.width,
    },
  },
  beats: [{ id: 'typography', title: 'What an essay file can say', goal: 'See every Markdown element.' }],
});

const essayMeta: EssayMeta = {
  title: 'Markdown in an essay',
  authors: ['A. Researcher'],
  date: '2026-11-23',
  summary: 'Headings, lists, quotes, code, tables and links as an essay file writes them. The text is synthetic.',
};

const { Beat, Param, Value, Footnote, Aside } = essayComponents;
const { h2: Section, h3: Subsection, p: Paragraph, a: Link, ul: List, ol: Ordered, li: Item } = essayComponents;
const { blockquote: Quote, code: Code, pre: Pre, table: Table, th: Head, td: Cell, hr: Rule } = essayComponents;
const { em: Emphasis, strong: Strong } = essayComponents;

/** What the compiled MDX file would return: the same elements, written by hand. */
function Compiled(): ReactNode {
  return (
    <Beat id="typography">
      <Paragraph>
        An essay file is Markdown with <Strong>strong</Strong> and <Emphasis>emphasized</Emphasis> words, inline code
        such as <Code>defineLesson</Code>, and <Link href="https://worrydream.com/ExplorableExplanations/">links</Link>.
        A layer of width <Param name="width" /> holds <Value name="weights" /> weights.
        <Footnote id="square">Square layers only: width times width.</Footnote>
      </Paragraph>
      <Section>A section heading</Section>
      <Paragraph>
        Inline math <Code className="language-math math-inline">{String.raw`W \in \mathbb{R}^{n \times n}`}</Code> and
        display math reach the article’s typesetter:
      </Paragraph>
      <Pre>
        <Code className="language-math math-display">{String.raw`y = \frac{Wx + b}{\sqrt{n}}`}</Code>
      </Pre>
      <Subsection>Lists and a quotation</Subsection>
      <List>
        <Item>Bulleted items keep the article’s measure.</Item>
        <Item>Each item breathes the same as a paragraph.</Item>
      </List>
      <Ordered>
        <Item>Numbered items count.</Item>
        <Item>And stay aligned.</Item>
      </Ordered>
      <Quote>
        <Paragraph>A quotation takes the muted color and a rule on its side.</Paragraph>
      </Quote>
      <Pre>
        <Code className="language-ts">
          {"const lesson = defineLesson({ id: 'markdown', title: 'Markdown', params: {} });"}
        </Code>
      </Pre>
      <Table>
        <thead>
          <tr>
            <Head>Layer</Head>
            <Head align="right">Weights</Head>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Cell>Embedding</Cell>
            <Cell align="right">512</Cell>
          </tr>
          <tr>
            <Cell>Attention</Cell>
            <Cell align="right">1,024</Cell>
          </tr>
        </tbody>
      </Table>
      <Rule />
      <Aside>An aside sits in the margin on wide screens.</Aside>
    </Beat>
  );
}

function EssayPage({ view }: { readonly view: 'article' | 'static' }): ReactNode {
  return (
    <div {...stylex.props(styles.page)}>
      <Essay lesson={lesson} content={Compiled} locale="en-US" math={standInMath} view={view} {...essayMeta} />
    </div>
  );
}

export const Default: Story = { render: () => <EssayPage view="article" /> };

export const Static: Story = { render: () => <EssayPage view="static" /> };

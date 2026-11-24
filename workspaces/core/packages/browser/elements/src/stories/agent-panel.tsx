import * as stylex from '@stylexjs/stylex';
import { createAgent } from '@ui-sdk/react/agent';
import type { AgentStep } from '@ui-sdk/react/agent';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../packages/core/src/actions.tsx';
import { colors, radii, spacing, typography } from '../../packages/foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  panel: { display: 'grid', gap: spacing.md, maxWidth: 680, marginBlockStart: spacing.xl },
  actions: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm },
  log: {
    margin: 0,
    padding: spacing.md,
    maxHeight: 240,
    overflow: 'auto',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    fontSize: typography.captionSize,
    whiteSpace: 'pre-wrap',
  },
});

export type AgentPanelProps = {
  /** The label of the button that sends `steps`. */
  readonly ask: string;
  /** What the agent asks of the page, through the same bridge a real agent uses. */
  readonly steps: ReadonlyArray<AgentStep>;
};

/** Sends the steps an agent would send, and reads the reader's progress as an agent sees it. */
export function AgentPanel({ ask, steps }: AgentPanelProps): ReactNode {
  const [agent] = useState(() => createAgent());
  const [text, setText] = useState('The agent has done nothing yet.');

  return (
    <div {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.actions)}>
        <Button
          onClick={async () => {
            const result = await agent.act({ steps: [...steps] });

            setText(JSON.stringify(result, null, 2));
          }}
        >
          {ask}
        </Button>
        <Button
          onClick={() =>
            setText(
              JSON.stringify(
                agent.snapshot().filter((entry) => entry.component === 'lesson-progress'),
                null,
                2,
              ),
            )
          }
        >
          Read progress as an agent
        </Button>
      </div>
      <pre aria-label="Agent output" {...stylex.props(styles.log)}>
        {text}
      </pre>
    </div>
  );
}

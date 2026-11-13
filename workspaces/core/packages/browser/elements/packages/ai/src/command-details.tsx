import type { ReactNode } from 'react';
import { CodeBlock } from '../../content/src/code/index.ts';
import { LogViewer } from '../../content/src/index.ts';
import { Muted, Stack } from '../../core/src/index.ts';

export type CommandDetailsProps = {
  readonly command?: string | undefined;
  readonly output?: string | undefined;
  readonly commandNotice?: string | undefined;
  readonly outputNotice?: string | undefined;
  readonly outputLanguage?: string;
  readonly isRunning?: boolean;
};

export function CommandDetails({
  command,
  output,
  commandNotice,
  outputNotice,
  outputLanguage,
  isRunning = false,
}: CommandDetailsProps): ReactNode {
  return (
    <Stack isCompact>
      {command === '' && commandNotice !== undefined ? (
        <Muted>Command omitted from this preview.</Muted>
      ) : command === undefined ? (
        <Muted>{isRunning ? 'Preparing command…' : 'Command unavailable.'}</Muted>
      ) : (
        <CodeBlock
          code={command}
          language="bash"
          filename="Command"
          variant="embedded"
          showLineNumbers={false}
          shouldWrap
          maxHeight={240}
        />
      )}
      {commandNotice !== undefined && <Muted>{commandNotice}</Muted>}
      {output === undefined || output.length === 0 ? (
        <Muted>
          {isRunning
            ? 'Waiting for output…'
            : output === undefined
              ? 'Output unavailable.'
              : outputNotice === undefined
                ? 'No output.'
                : 'Output omitted from this preview.'}
        </Muted>
      ) : outputLanguage === undefined ? (
        <LogViewer output={output} label="Output" variant="embedded" isRunning={isRunning} />
      ) : (
        <CodeBlock
          code={output}
          language={outputLanguage}
          filename="Output"
          variant="embedded"
          showLineNumbers={false}
          shouldWrap
          isStreaming={isRunning}
          maxHeight={320}
        />
      )}
      {outputNotice !== undefined && <Muted>{outputNotice}</Muted>}
    </Stack>
  );
}

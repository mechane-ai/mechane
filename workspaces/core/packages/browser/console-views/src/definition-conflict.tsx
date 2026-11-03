import type { Mech } from '@mechane/protocol';
import { Button, Muted, Panel, Prose, Row, Stack, Subheading } from '@mechane/ui';
import { Option } from 'effect';
import type { ReactNode } from 'react';

type SavedDefinition = Pick<Mech, 'revision' | 'name' | 'model' | 'dailyCapMicros' | 'instructions'>;

export function DefinitionConflict({
  saved,
  onContinue,
  onRefresh,
}: {
  readonly saved: SavedDefinition | undefined;
  readonly onContinue: () => void;
  readonly onRefresh: () => void;
}): ReactNode {
  return (
    <Panel>
      <Stack compact>
        <Subheading>Definition changed</Subheading>
        {saved === undefined ? (
          <>
            <Muted>Reading the latest revision. Your draft is kept below.</Muted>
            <Row>
              <Button onClick={onRefresh}>Refresh definition</Button>
            </Row>
          </>
        ) : (
          <>
            <Muted>
              Saved revision {saved.revision} · {saved.name} · {saved.model} · daily cap $
              {saved.dailyCapMicros / 1_000_000}
            </Muted>
            <Prose>{Option.getOrElse(saved.instructions, () => 'No additional instructions.')}</Prose>
            <Muted>Continuing keeps your edits and takes the latest saved values for fields you left alone.</Muted>
            <Row>
              <Button onClick={onContinue}>Continue with my draft</Button>
            </Row>
          </>
        )}
      </Stack>
    </Panel>
  );
}

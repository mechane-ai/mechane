import { defineRegistry } from '@json-render/react';
import { Button, Divider, Muted, Panel, Row, Stack, Text } from '@mechane-ai/elements';
import { Details } from '@mechane-ai/elements/collections';
import { Markdown } from '@mechane-ai/elements/content/markdown';
import { PresentationCatalog } from '@mechane/protocol/presentation';
import type { ReactNode } from 'react';
import { PresentationChart } from './chart.tsx';
import { PresentationTable } from './table.tsx';

const { registry } = defineRegistry(PresentationCatalog, {
  components: {
    Card: ({ props, children }) => (
      <Panel>
        <Stack>
          <CardHeader title={props.title} subtitle={props.subtitle} />
          {children}
        </Stack>
      </Panel>
    ),
    Section: ({ children }) => <Stack isCompact>{children}</Stack>,
    Text: ({ props }) => (
      <Markdown
        headingLevel={3}
        tone={props.style === 'muted' ? 'muted' : 'default'}
        weight={props.style === 'bold' ? 'strong' : 'regular'}
      >
        {props.content}
      </Markdown>
    ),
    Fields: ({ children }) => <Stack isCompact>{children}</Stack>,
    Field: ({ props }) => <Details items={[{ label: props.label, value: props.value }]} />,
    Table: ({ props }) => <PresentationTable headers={props.headers} rows={props.rows} caption={props.caption} />,
    Chart: PresentationChart,
    Divider: () => <Divider />,
    Actions: ({ children }) => <Row>{children}</Row>,
    LinkButton: ({ props }) => (
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={props.url} target="_blank" rel="noopener noreferrer" />}
      >
        {props.label}
      </Button>
    ),
  },
});

function CardHeader({
  title,
  subtitle,
}: {
  readonly title: string | null | undefined;
  readonly subtitle: string | null | undefined;
}): ReactNode {
  const hasTitle = (title?.length ?? 0) > 0;
  const hasSubtitle = (subtitle?.length ?? 0) > 0;

  if (!hasTitle && !hasSubtitle) {
    return null;
  }

  return (
    <Stack isCompact>
      {hasTitle && (
        <Text>
          <strong>{title}</strong>
        </Text>
      )}
      {hasSubtitle && <Muted>{subtitle}</Muted>}
    </Stack>
  );
}

export const presentationRegistry = registry;

import { Stack, Text } from '@mechane-ai/elements';
import type { ChartTone } from '@mechane-ai/elements/charts';
import { BreakdownBar, BridgeChart } from '@mechane-ai/elements/charts/cartesian';
import type { BridgeStep, ChartReferenceLine } from '@mechane-ai/elements/charts/cartesian';
import { FlowDiagram } from '@mechane-ai/elements/charts/graph';
import type { FlowLink, FlowNode } from '@mechane-ai/elements/charts/graph';
import { PageContent, PageLayout } from '@mechane-ai/elements/layout';

type AllocationPart = { readonly id: string; readonly label: string; readonly amount: number };

type Commitment = AllocationPart & { readonly tone: ChartTone; readonly parts?: ReadonlyArray<AllocationPart> };

type AllocationProps = {
  readonly title: string;
  readonly headline: string;
  readonly totalLabel: string;
  readonly total: number;
  readonly commitments: ReadonlyArray<Commitment>;
  readonly remainderLabel: string;
  readonly target?: ChartReferenceLine;
  readonly explanation: 'bridge' | 'flow';
  readonly formatValue: (value: number) => string;
};

const REMAINDER_ID = 'remainder';
const REMAINDER_TONE: ChartTone = 'series2';

/**
 * Explain how one total divides among commitments and what remains, with the parts strip above one explanatory chart.
 * Use a BridgeChart for the path from total to remainder, or a FlowDiagram when commitments divide again. Give each
 * commitment one tone everywhere; the application computes amounts and writes the report's one-sentence headline.
 */
export function AllocationReport({
  title,
  headline,
  totalLabel,
  total,
  commitments,
  remainderLabel,
  target,
  explanation,
  formatValue,
}: AllocationProps) {
  const remainder = total - commitments.reduce((sum, commitment) => sum + commitment.amount, 0);
  const report = { summary: <Text>{headline}</Text> };

  const steps: ReadonlyArray<BridgeStep> = [
    { id: 'total', label: totalLabel, kind: 'start', value: total, tone: 'series1' },
    ...commitments.map((commitment): BridgeStep => ({
      id: commitment.id,
      label: commitment.label,
      kind: 'change',
      value: -commitment.amount,
      tone: commitment.tone,
    })),
    { id: REMAINDER_ID, label: remainderLabel, kind: 'total', tone: REMAINDER_TONE },
  ];

  const nodes: ReadonlyArray<FlowNode> = [
    { id: 'total', label: totalLabel, tone: 'series1' },
    ...commitments.flatMap((commitment) => [
      { id: commitment.id, label: commitment.label, tone: commitment.tone },
      ...(commitment.parts ?? []).map((part) => ({ id: part.id, label: part.label, tone: commitment.tone })),
    ]),
    { id: REMAINDER_ID, label: remainderLabel, tone: REMAINDER_TONE },
  ];

  const links: ReadonlyArray<FlowLink> = [
    ...commitments.flatMap((commitment) => [
      { id: `total-${commitment.id}`, sourceId: 'total', targetId: commitment.id, value: commitment.amount },
      ...(commitment.parts ?? []).map((part) => ({
        id: `${commitment.id}-${part.id}`,
        sourceId: commitment.id,
        targetId: part.id,
        value: part.amount,
      })),
    ]),
    { id: `total-${REMAINDER_ID}`, sourceId: 'total', targetId: REMAINDER_ID, value: remainder },
  ];

  return (
    <PageLayout title={title} showNavigation={false}>
      <PageContent>
        <Stack>
          <BreakdownBar
            title={`${totalLabel}: ${formatValue(total)}`}
            items={[
              ...commitments.map(({ id, label, amount, tone }) => ({ id, label, value: amount, tone })),
              { id: REMAINDER_ID, label: remainderLabel, value: remainder, tone: REMAINDER_TONE },
            ]}
            total={total}
            formatValue={formatValue}
          />
          {explanation === 'bridge' ? (
            <BridgeChart
              title={`From ${totalLabel.toLowerCase()} to ${remainderLabel.toLowerCase()}`}
              report={report}
              steps={steps}
              formatValue={formatValue}
              referenceLines={target === undefined ? [] : [target]}
            />
          ) : (
            <FlowDiagram
              title={`Where ${totalLabel.toLowerCase()} goes`}
              report={report}
              nodes={nodes}
              links={links}
              formatValue={formatValue}
            />
          )}
        </Stack>
      </PageContent>
    </PageLayout>
  );
}

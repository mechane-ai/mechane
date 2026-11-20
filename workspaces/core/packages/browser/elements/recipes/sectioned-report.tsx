import { DataTable, Metric, MetricGrid } from '@mechane-ai/elements/collections';
import type { DataTableColumn } from '@mechane-ai/elements/collections';
import { PageLayout, PageSection } from '@mechane-ai/elements/layout';

type ReportRow = { readonly id: string; readonly name: string; readonly team: string };

type ReportSection = {
  readonly id: string;
  readonly title: string;
  readonly metric: { readonly label: string; readonly value: string };
  readonly contributors: ReadonlyArray<ReportRow>;
};

type ReportProps = { readonly sections: ReadonlyArray<ReportSection> };

const columns = [
  { id: 'name', label: 'Work item', role: 'primary', cell: (row) => row.name },
  { id: 'team', label: 'Team', role: 'text', cell: (row) => row.team },
] satisfies ReadonlyArray<DataTableColumn<ReportRow>>;

/**
 * Build a scrolling report with a persistent page toolbar and rotating sticky section headings. Each section owns its
 * summary and full-width breakdown.
 */
export function SectionedReport({ sections }: ReportProps) {
  return (
    <PageLayout title="Work overview" showNavigation={false}>
      {sections.map((section) => (
        <PageSection
          key={section.id}
          id={section.id}
          title={section.title}
          summary={
            <MetricGrid>
              <Metric {...section.metric} variant="headline" />
            </MetricGrid>
          }
          breakdown={
            <DataTable
              caption={section.title}
              hideCaption
              rows={section.contributors}
              getRowId={(row) => row.id}
              columns={columns}
              query={{
                mode: 'local',
                search: (row) => row.name,
                filters: [{ id: 'team', label: 'Team', value: (row) => row.team }],
              }}
              empty="No contributing work items."
              filteredEmpty="No matching work items."
            />
          }
        />
      ))}
    </PageLayout>
  );
}

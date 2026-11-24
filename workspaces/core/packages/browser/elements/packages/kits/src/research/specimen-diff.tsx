import type { ReactNode } from 'react';
import { BreakdownBar } from '../../../charts/src/cartesian/index.ts';
import type { FigureProps } from '../../../charts/src/index.ts';
import { DataTable, DataTableText } from '../../../collections/src/index.ts';
import type { DataTableColumn } from '../../../collections/src/index.ts';
import { TextMatch } from '../../../content/src/index.ts';
import { Badge, Identifier, Stack, Text } from '../../../core/src/index.ts';
import { EmptyState } from '../../../feedback/src/index.ts';
import { SegmentedControl } from '../../../forms/src/index.ts';

export type SpecimenOutcome = 'gained' | 'regressed' | 'both_pass' | 'both_fail';

export type SpecimenFilter = 'all' | SpecimenOutcome;

export type SpecimenDiffRow = {
  readonly id: string;
  readonly prompt: string;
  readonly family: string;
  readonly expected: string;
  readonly baselineOutput: string;
  readonly candidateOutput: string;
  readonly outcome: SpecimenOutcome;
};

export type SpecimenDiffLabels = {
  readonly breakdownTitle: string;
  readonly all: string;
  readonly gained: string;
  readonly regressed: string;
  readonly bothPass: string;
  readonly bothFail: string;
  readonly specimen: string;
  readonly expected: string;
  readonly baseline: string;
  readonly candidate: string;
  readonly outcome: string;
  readonly empty: string;
};

export type SpecimenDiffProps = Pick<FigureProps, 'title' | 'description' | 'locale' | 'status' | 'source'> & {
  readonly rows: ReadonlyArray<SpecimenDiffRow>;
  readonly baselineLabel: string;
  readonly candidateLabel: string;
  readonly filter: SpecimenFilter;
  readonly onFilterChange: (filter: SpecimenFilter) => void;
  readonly onSelectRow?: ((row: SpecimenDiffRow) => void) | undefined;
  readonly labels?: Partial<SpecimenDiffLabels> | undefined;
};

const defaultLabels: SpecimenDiffLabels = {
  breakdownTitle: 'Paired outcome flips',
  all: 'All',
  gained: 'Gained',
  regressed: 'Regressed',
  bothPass: 'Both pass',
  bothFail: 'Both fail',
  specimen: 'Specimen',
  expected: 'Expected',
  baseline: 'Baseline',
  candidate: 'Candidate',
  outcome: 'Outcome',
  empty: 'No paired specimens available for these two runs.',
};

const outcomeTone: Readonly<Record<SpecimenOutcome, 'positive' | 'negative' | 'neutral'>> = {
  gained: 'positive',
  regressed: 'negative',
  both_pass: 'neutral',
  both_fail: 'neutral',
};

const outcomeKeys: ReadonlySet<string> = new Set(['gained', 'regressed', 'both_pass', 'both_fail']);

function isSpecimenOutcome(id: string | null): id is SpecimenOutcome {
  return id !== null && outcomeKeys.has(id);
}

/**
 * Paired before/after example inspection: a `BreakdownBar` of outcome flips above a searchable specimen table that
 * highlights expected targets with `TextMatch`. Composes Elements families with zero custom SVG.
 */
export function SpecimenDiff({
  rows,
  baselineLabel,
  candidateLabel,
  filter,
  onFilterChange,
  onSelectRow,
  labels: given,
  ...figure
}: SpecimenDiffProps): ReactNode {
  const labels = { ...defaultLabels, ...given };

  if (rows.length === 0) {
    return <EmptyState title={figure.title}>{labels.empty}</EmptyState>;
  }

  const counts: Record<SpecimenOutcome, number> = { gained: 0, regressed: 0, both_pass: 0, both_fail: 0 };

  for (const row of rows) {
    counts[row.outcome] += 1;
  }

  const visible = filter === 'all' ? rows : rows.filter((row) => row.outcome === filter);

  const outcomeName: Record<SpecimenOutcome, string> = {
    gained: labels.gained,
    regressed: labels.regressed,
    both_pass: labels.bothPass,
    both_fail: labels.bothFail,
  };

  const columns = [
    {
      id: 'specimen',
      label: labels.specimen,
      role: 'primary',
      cell: (row: SpecimenDiffRow) => <DataTableText secondary={row.family}>{row.prompt}</DataTableText>,
    },
    {
      id: 'expected',
      label: labels.expected,
      role: 'text',
      cell: (row: SpecimenDiffRow) => <Identifier>{row.expected}</Identifier>,
    },
    {
      id: 'baseline',
      label: baselineLabel.trim() === '' ? labels.baseline : baselineLabel,
      role: 'text',
      isSecondary: true,
      cell: (row: SpecimenDiffRow) => (
        <Text variant="mono">
          <TextMatch text={row.baselineOutput} query={row.expected} tone="accent" />
        </Text>
      ),
    },
    {
      id: 'candidate',
      label: candidateLabel.trim() === '' ? labels.candidate : candidateLabel,
      role: 'text',
      cell: (row: SpecimenDiffRow) => (
        <Text variant="mono">
          <TextMatch text={row.candidateOutput} query={row.expected} tone="accent" />
        </Text>
      ),
    },
    {
      id: 'outcome',
      label: labels.outcome,
      role: 'status',
      cell: (row: SpecimenDiffRow) => <Badge tone={outcomeTone[row.outcome]}>{outcomeName[row.outcome]}</Badge>,
    },
  ] satisfies ReadonlyArray<DataTableColumn<SpecimenDiffRow> & { readonly canSort?: false }>;

  return (
    <Stack isCompact>
      <BreakdownBar
        title={labels.breakdownTitle}
        description={figure.description}
        locale={figure.locale}
        status={figure.status}
        source={figure.source}
        total={rows.length}
        valueFormat={{ maximumFractionDigits: 0 }}
        items={[
          { id: 'gained', label: labels.gained, value: counts.gained, tone: 'positive' },
          { id: 'both_pass', label: labels.bothPass, value: counts.both_pass, tone: 'series1' },
          { id: 'regressed', label: labels.regressed, value: counts.regressed, tone: 'negative' },
          { id: 'both_fail', label: labels.bothFail, value: counts.both_fail, tone: 'series5' },
        ]}
        selected={filter === 'all' ? null : filter}
        onSelectedChange={(id) => {
          if (isSpecimenOutcome(id)) {
            onFilterChange(id === filter ? 'all' : id);
          } else {
            onFilterChange('all');
          }
        }}
      />
      <SegmentedControl.Root<SpecimenFilter>
        aria-label={labels.outcome}
        value={filter}
        onValueChange={(value) => {
          onFilterChange(value);
        }}
      >
        <SegmentedControl.Item value="all">
          {labels.all} ({rows.length})
        </SegmentedControl.Item>
        <SegmentedControl.Item value="gained">
          {labels.gained} ({counts.gained})
        </SegmentedControl.Item>
        <SegmentedControl.Item value="regressed">
          {labels.regressed} ({counts.regressed})
        </SegmentedControl.Item>
        <SegmentedControl.Item value="both_pass">
          {labels.bothPass} ({counts.both_pass})
        </SegmentedControl.Item>
        <SegmentedControl.Item value="both_fail">
          {labels.bothFail} ({counts.both_fail})
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      <DataTable<SpecimenDiffRow>
        caption={figure.title}
        hideCaption
        columns={columns}
        rows={visible}
        getRowId={(row) => row.id}
        {...(onSelectRow !== undefined && {
          rowAction: { label: (row) => `Inspect ${row.id}`, onActivate: onSelectRow },
        })}
        query={{
          mode: 'local',
          search: (row) => `${row.prompt} ${row.expected} ${row.baselineOutput} ${row.candidateOutput} ${row.family}`,
          filters: [{ id: 'family', label: 'Family', value: (row) => row.family }],
        }}
        empty={labels.empty}
        filteredEmpty="No specimens match the current filter."
      />
    </Stack>
  );
}

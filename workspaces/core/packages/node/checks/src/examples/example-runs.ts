import { placementSites } from '@mechane/normalizers';
import {
  checkSource,
  documentFindings,
  fileNameFindings,
  sourceSites,
  workflowFindings,
  WORKFLOWS,
} from '@mechane/owned-rules';
import { Normalizer } from '@mechane/rule-shapes';
import { gatedGlobs } from '@mechane/rules';
import { layoutRun } from './layout-run.ts';
import { runFindings } from './run-findings.ts';
import type { ExampleIndex, ExampleRun, RunFinding } from './types.ts';

/** The workflows the workflow rule reads, by their paths below the factory root. */
const WORKFLOW_PATHS: ReadonlySet<string> = new Set(WORKFLOWS);

/**
 * How each owned rule that one small tree shows decides on an example's tree, by the rule's name. Each run makes the
 * decision the rule's check makes on the workspace, from the same functions, over the example's files in memory.
 */
export const EXAMPLE_RUNS: Readonly<Record<string, ExampleRun>> = {
  'layout': layoutRun,
  'file-names': ({ sources }) => runFindings({ findings: fileNameFindings({ sources }) }),
  'one-value': sourceSitesRun,
  'export-doc': sourceSitesRun,
  'absence-doc': sourceSitesRun,
  'short-doc': sourceSitesRun,
  'span-name': sourceSitesRun,
  'banned-words': sourceSitesRun,
  'logical-operators': sourceSitesRun,
  'patterns': sourceCheckRun,
  'comment-width': sourceCheckRun,
  'documents': ({ files }) => runFindings({ findings: documentFindings({ files }) }),
  'workflows': ({ files }) =>
    runFindings({
      findings: files.filter(({ path }) => WORKFLOW_PATHS.has(path)).flatMap((file) => workflowFindings(file)),
    }),
  'placement-blocked': ({ sources, members, entries }) =>
    placementSites({
      sources,
      entries,
      scope: { paths: [], excluded: gatedGlobs({ rule: Normalizer.Placement }) },
      roots: members.flatMap(({ sourceRoots }) => sourceRoots),
    }),
};

/** The owned sites of each parsed file: its one value, doc comments, span names, logical operators and banned words. */
function sourceSitesRun({ sources, phrases }: ExampleIndex): ReadonlyArray<RunFinding> {
  return sources.flatMap((source) => sourceSites({ source, phrases }));
}

/** The source check's findings: its comment widths, schema aliases and repeated patterns. */
function sourceCheckRun({ sources }: ExampleIndex): ReadonlyArray<RunFinding> {
  return runFindings({ findings: checkSource({ sources }) });
}

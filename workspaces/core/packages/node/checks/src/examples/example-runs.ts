import {
  AUTOMATION_FILE,
  checkSource,
  documentedExports,
  documentFindings,
  sourceSites,
  workflowFindings,
} from '@mechane/owned-rules';
import { runFindings } from './run-findings.ts';
import type { ExampleIndex, ExampleRun, RunFinding } from './types.ts';

/**
 * How each owned rule that one small tree shows decides on an example's tree, by the rule's name. Each run makes the
 * decision the rule's check makes on the workspace, from the same functions, over the example's files in memory.
 */
export const EXAMPLE_RUNS: Readonly<Record<string, ExampleRun>> = {
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
      findings: files.filter(({ path }) => AUTOMATION_FILE.test(path)).flatMap((file) => workflowFindings(file)),
    }),
};

/** The owned sites of each parsed file: doc comments, span names, logical operators and banned words. */
function sourceSitesRun({ sources, phrases }: ExampleIndex): ReadonlyArray<RunFinding> {
  const documentation = documentedExports({ sources });

  return sources.flatMap((source) => sourceSites({ source, phrases, documentation }));
}

/** The source check's findings: its comment widths, schema aliases and repeated patterns. */
function sourceCheckRun({ sources }: ExampleIndex): ReadonlyArray<RunFinding> {
  return runFindings({ findings: checkSource({ sources }) });
}

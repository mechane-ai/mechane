import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile } from '../types.ts';
import { configurationText } from './configuration-text.ts';

/** `.jscpd.json`: what jscpd scans, and the smallest copied block it fails on. */
export function duplicatesConfiguration(): GeneratedFile {
  const { jscpd } = CONTRACTS['code-duplicated-blocks'].values;

  return {
    path: ConfigurationPath.Duplicates,
    text: configurationText({ value: jscpd, notes: [], expanded: [], syntax: Syntax.Json }),
  };
}

import { Array } from 'effect';
import type { SUITE } from './constants.ts';

/** A case of the scenario's suite. */
type SuiteCase = (typeof SUITE.cases)[number];

/** An expectation of a case of the scenario's suite. */
type SuiteExpectation = SuiteCase['expectations'][number];

/** The cases of the scenario's suite. */
type ExpectationTextsInput = { readonly cases: ReadonlyArray<SuiteCase> };

/**
 * Every expectation's text as a request's JSON body writes it, which no subject's request may hold: each id, and each
 * description with its newline and quotes escaped.
 */
export function expectationTexts({ cases }: ExpectationTextsInput): ReadonlyArray<string> {
  const texts: (expectation: SuiteExpectation) => ReadonlyArray<string> = ({ id, description }) => [
    id,
    JSON.stringify(description).slice(1, -1),
  ];

  const caseTexts: (suiteCase: SuiteCase) => ReadonlyArray<string> = ({ expectations }) =>
    Array.flatMap(expectations, texts);

  return Array.flatMap(cases, caseTexts);
}

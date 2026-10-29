import type { HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import type { BrowserStep } from '../constants.ts';
import { BrowserRefused } from '../errors.ts';
import type { Page } from './types.ts';

/** The status a person's browser expects of a step's answer. */
type ExpectedStatus = { readonly expected: HttpStatusCode };

/** A page a step got, and the status a person's browser expects of it. */
type ExpectedPageInput = ExpectedStatus & { readonly step: BrowserStep; readonly page: Page };

/** The page, when it answered with the status a person's browser expects at this step. */
export const expectedPage = Effect.fn('expectedPage')(function* ({
  step,
  page,
  expected,
}: ExpectedPageInput): Effect.fn.Return<Page, BrowserRefused> {
  if (page.status !== expected) {
    return yield* new BrowserRefused({
      step,
      url: page.url,
      reason: `answered with status ${page.status}, not ${expected}`,
    });
  }

  return page;
});

import type { WorkerSettings } from '@mechane/bindings';
import type { ObjectUnavailable, RateLimited } from '@mechane/protocol';
import type { HttpHeader } from '@mechane/records';
import type { GitHubRefused, GitHubUnavailable, PageRefused } from './errors.ts';

export type PageInput = { readonly request: Request; readonly url: URL; readonly settings: WorkerSettings };

/** Every failure a page answers with a page of its own. */
export type PageFailure = PageRefused | ObjectUnavailable | GitHubUnavailable | GitHubRefused | RateLimited;

/** One header a page answers with beside the pages' own: its name and value. */
export type PageHeader = readonly [HttpHeader, string];

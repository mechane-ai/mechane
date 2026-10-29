import type { HttpStatusCode } from '@mechane/records';
import type { BrowserStep } from '../constants.ts';

/** A page a browser opened or a form it posted brought back: its URL, status, headers and text. */
export type Page = { readonly url: URL; readonly status: number; readonly headers: Headers; readonly text: string };

/** The cookies a browser keeps for the deployment, by name. */
export type CookieJar = ReadonlyMap<string, string>;

/** The headers a signed-in browser sends with each request: the cookie of its session. */
export type BrowserHeaders = Readonly<Record<string, string>>;

/** A page a step reads. */
export type PageInput = { readonly page: Page };

type GithubBrowserIdentity = { readonly login: string };

type LocalBrowserIdentity = { readonly bootstrapSecret: string };

/** Chooses the scenario's GitHub user or the local owner's bootstrap credentials. */
export type BrowserIdentity = GithubBrowserIdentity | LocalBrowserIdentity;

export type SignedInBrowserInput = { readonly url: URL } & BrowserIdentity;

/** A request a step sends. */
export type SendInput = { readonly step: BrowserStep; readonly request: Request };

/** The status a person's browser expects of a step's answer. */
export type ExpectedStatus = { readonly expected: HttpStatusCode };

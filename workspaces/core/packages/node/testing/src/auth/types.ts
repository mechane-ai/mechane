import type { LocalStack } from '@mechane/stack';

export type BrowserPage = {
  readonly url: URL;
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
};

export type BrowserRequest = {
  readonly url: URL;
  readonly method?: string;
  readonly headers?: RequestInit['headers'];
  readonly body?: RequestInit['body'];
  readonly shouldFollowRedirects?: boolean;
};

export type BrowserForm = { readonly page: BrowserPage; readonly fields?: Readonly<Record<string, string>> };

export type SmokeBrowser = {
  readonly request: (input: BrowserRequest) => Promise<BrowserPage>;
  readonly submit: (input: BrowserForm) => Promise<BrowserPage>;
};

export type Account = {
  readonly login: string;
  readonly configurationRoot: string;
  readonly token: string;
  readonly principalId: string;
  readonly workspaceId: string;
  readonly keyId: string;
  readonly browser: SmokeBrowser;
};

export type CreateAccountInput = { readonly stack: LocalStack; readonly login?: string };

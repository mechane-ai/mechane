import { defaultRehypePlugins, defaultRemarkPlugins } from 'streamdown';
import type { StreamdownProps, UrlTransform } from 'streamdown';
import { contentHref } from '../content-link.tsx';

const URL_ATTRIBUTES: ReadonlySet<string> = new Set(['href', 'src']);

const safeUrl: UrlTransform = (value, key) => {
  if (!URL_ATTRIBUTES.has(key)) {
    return;
  }

  return contentHref(value);
};

const rehypePlugins = Object.entries(defaultRehypePlugins)
  .filter(([name]) => name === 'sanitize')
  .map(([, plugin]) => plugin);

export const markdownOptions: Readonly<
  Pick<StreamdownProps, 'rehypePlugins' | 'remarkPlugins' | 'skipHtml' | 'urlTransform'>
> = { rehypePlugins, remarkPlugins: Object.values(defaultRemarkPlugins), skipHtml: true, urlTransform: safeUrl };

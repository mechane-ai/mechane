import { MediaType } from '@mechane/records';
import { extname } from 'node:path';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': MediaType.Css,
  '.gif': MediaType.Gif,
  '.html': MediaType.Html,
  '.ico': MediaType.Icon,
  '.jpeg': MediaType.Jpeg,
  '.jpg': MediaType.Jpeg,
  '.js': MediaType.JavaScript,
  '.json': MediaType.Json,
  '.map': MediaType.Json,
  '.png': MediaType.Png,
  '.svg': MediaType.Svg,
  '.txt': MediaType.PlainText,
  '.webp': MediaType.Webp,
  '.woff': MediaType.Woff,
  '.woff2': MediaType.Woff2,
};

type ContentTypeInput = { readonly path: string };

export function consoleContentType({ path }: ContentTypeInput): string {
  return CONTENT_TYPES[extname(path)] ?? MediaType.OctetStream;
}

/** The media types Mechane sends and reads, each with its charset parameter where it names one. */
export const MediaType = {
  JavaScript: 'text/javascript; charset=utf-8',
  JavaScriptModule: 'application/javascript+module',
  WebAssembly: 'application/wasm',
  Css: 'text/css; charset=utf-8',
  Svg: 'image/svg+xml',
  Png: 'image/png',
  Mp4: 'video/mp4',
  Jpeg: 'image/jpeg',
  Gif: 'image/gif',
  Webp: 'image/webp',
  Icon: 'image/x-icon',
  Woff2: 'font/woff2',
  Woff: 'font/woff',
  Json: 'application/json',
  FormUrlEncoded: 'application/x-www-form-urlencoded',
  OctetStream: 'application/octet-stream',
  GitHubJson: 'application/vnd.github+json',
  EventStream: 'text/event-stream',
  Html: 'text/html; charset=utf-8',
  HtmlDocument: 'text/html',
  PlainText: 'text/plain',
  Utf8PlainText: 'text/plain; charset=utf-8',
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];

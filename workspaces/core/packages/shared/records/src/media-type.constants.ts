/** The media types Mechane sends and reads, each with its charset parameter where it names one. */
export const MediaType = {
  Json: 'application/json',
  OctetStream: 'application/octet-stream',
  GitHubJson: 'application/vnd.github+json',
  EventStream: 'text/event-stream',
  Html: 'text/html; charset=utf-8',
  PlainText: 'text/plain',
  Utf8PlainText: 'text/plain; charset=utf-8',
} as const;

export type MediaType = (typeof MediaType)[keyof typeof MediaType];

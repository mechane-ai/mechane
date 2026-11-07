import { z } from 'zod';

const TEXT_MAX_CHARS = 80_000;
const FILES_MAX_ITEMS = 20;
const FILE_NAME_MAX_CHARS = 256;
const SLACK_IDENTIFIER_MAX_CHARS = 128;
const SLACK_URL_MAX_CHARS = 2048;
const SLACK_CHALLENGE_MAX_CHARS = 2048;

const SlackFile = z.object({
  id: z.string().max(SLACK_IDENTIFIER_MAX_CHARS),
  name: z.string().max(FILE_NAME_MAX_CHARS).optional(),
  mimetype: z.string().max(SLACK_IDENTIFIER_MAX_CHARS).optional(),
  size: z.number().int().nonnegative().optional(),
  url_private: z.string().max(SLACK_URL_MAX_CHARS).optional(),
});

export const SlackMessageEvent = z.object({
  type: z.enum(['message', 'app_mention']),
  channel: z.string().min(1).max(SLACK_IDENTIFIER_MAX_CHARS),
  ts: z.string().regex(/^\d+\.\d+$/u),
  thread_ts: z
    .string()
    .regex(/^\d+\.\d+$/u)
    .optional(),
  user: z.string().max(SLACK_IDENTIFIER_MAX_CHARS).optional(),
  text: z.string().max(TEXT_MAX_CHARS).optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  channel_type: z.string().optional(),
  files: z.array(SlackFile).max(FILES_MAX_ITEMS).optional(),
  team: z.string().optional(),
  team_id: z.string().optional(),
});

export type SlackMessageEvent = z.infer<typeof SlackMessageEvent>;

export const SlackEventEnvelope = z.object({
  type: z.literal('event_callback'),
  event_id: z.string().min(1).max(SLACK_IDENTIFIER_MAX_CHARS),
  team_id: z.string().min(1).max(SLACK_IDENTIFIER_MAX_CHARS),
  event: z.unknown(),
});

export const SlackChallenge = z.object({
  type: z.literal('url_verification'),
  challenge: z.string().min(1).max(SLACK_CHALLENGE_MAX_CHARS),
});

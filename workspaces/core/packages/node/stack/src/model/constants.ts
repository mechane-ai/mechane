/** The key the scripted model upstream accepts, which the stack stages as a deployment's secret. */
export const SCRIPTED_MODEL_KEY = 'scripted-model-key';

/** The URL path the Worker's model upstream names, and the one route the scripted upstream serves below it. */
export const ScriptedPath = { Upstream: '/v1', Completions: '/v1/chat/completions' } as const;

/** The chat roles the scripted upstream reads: a person's message, a tool's result, and the model's own message. */
export const ChatRole = { User: 'user', Tool: 'tool', Assistant: 'assistant' } as const;

/** What starts a line of a person's script that calls the tool it names, with a JSON object after it. */
export const TOOL_CALL_PREFIX = '@';

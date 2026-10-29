import { Schema } from 'effect';
import { SavedLogin } from '../schemas.ts';

/** The saved login as its file holds it. */
export const SavedLoginJson = Schema.fromJsonString(SavedLogin);

export type SavedLoginJson = typeof SavedLoginJson.Type;

import { isWellFormedText, SHA256_PATTERN } from '@mechane/records';
import { Schema } from 'effect';

const POSTGRES_TIMESTAMP_PATTERN = /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Historical Postgres TEXT has no size bound; UTF-8 guarantees whole Unicode characters.
export const StoredText = Schema.String.check(isWellFormedText);
export const StoredTimestamp = Schema.String.check(Schema.isPattern(POSTGRES_TIMESTAMP_PATTERN));
export const StoredChecksum = Schema.String.check(Schema.isPattern(SHA256_PATTERN));
